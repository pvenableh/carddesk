import { createDirectus, rest, createUser, authentication, readUsers } from '@directus/sdk'
import type { H3Event } from 'h3'
import { getDirectus } from '../../utils/directus'
import { fetchUserProfile } from '../../utils/profile'
import { sendEmail } from '../../utils/email-send'
import { welcomeEmail } from '../../utils/emails/welcome'
import { ensureUserCredits } from '../../utils/ai-credits'
import { ensureCardDeskAccess } from '../../utils/carddesk-access'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, first_name, last_name, industry } = body

  if (!email || !password)
    throw createError({ statusCode: 400, message: 'Email and password are required' })

  const config = useRuntimeConfig()
  const admin = getDirectus()

  // CardDesk shares its user table with Earnest, and createUser enforces email
  // uniqueness across the WHOLE instance. So an email may already exist as a
  // returning CardDesk user OR as an Earnest-only user who's new to CardDesk —
  // both must be onboarded, not 400'd as "email in use". Look first; fall back
  // to plain creation if the lookup itself fails.
  let existing: { id: string; email?: string; status?: string; role?: string | null } | null = null
  try {
    // Directus has no case-insensitive-equals operator on user email, so match
    // case-insensitively client-side over a narrow _icontains candidate set.
    const target = String(email).toLowerCase()
    const found = (await admin.request(
      readUsers({ filter: { email: { _icontains: email } } as any, fields: ['id', 'email', 'status', 'role'], limit: 20 }),
    )) as any[]
    existing = (found ?? []).find((u) => (u.email ?? '').toLowerCase() === target) ?? null
  } catch (err) {
    console.warn('[register] existing-user lookup failed; proceeding as new:', err)
  }

  try {
    if (existing) return await onboardExistingUser(event, existing, { email, password })

    // Mirror the Earnest app: create the user with the static (elevated) token so
    // we can assign the CardDesk role and activate the account immediately. The
    // public /users/register endpoint can't set role/status and 400s when the
    // shared Directus instance requires them. The cd_* rows (xp, credits) are
    // created lazily on first use, so nothing else needs seeding here.
    const newUser = (await admin.request(
      createUser({
        email,
        password,
        first_name: first_name || undefined,
        last_name: last_name || undefined,
        industry: industry || undefined,
        status: 'active',
        role: config.public.directusRoleUser || undefined,
      })
    )) as any

    // Grant the one-time onboarding AI credits up front so new users start with
    // a real (non-zero) balance — instead of the grant firing lazily on first
    // AI use. Best-effort; never block signup on it.
    if (newUser?.id) {
      try { await ensureUserCredits(newUser.id) } catch (err) { console.warn('[register] credit grant failed:', err) }
    }

    // Auto-login after registration
    const result = await loginFresh(config.public.directusUrl, email, password)
    if (!result?.access_token)
      throw createError({ statusCode: 500, message: 'Registration succeeded but login failed' })

    await establishSession(event, email, result, true)
    return { ok: true, existing: false, onboarded: false }
  } catch (err: any) {
    if (err.statusCode) throw err // our own createError (e.g. 409 from onboardExistingUser)

    // Translate the Directus SDK error into an accurate, actionable message.
    // The old code blamed the email for EVERY 400, so a password-policy
    // rejection (or any other validation failure) surfaced as "email in use" —
    // leaving the user with no idea what actually went wrong.
    const dErr = Array.isArray(err?.errors) ? err.errors[0] : null
    const dCode: string | undefined = dErr?.extensions?.code
    const dMsg: string | undefined = dErr?.message
    const status = err?.response?.status ?? 500

    // Email already taken (the pre-check missed it — a race, or odd casing).
    // Treat it like the existing-user path so the client steers them to login.
    if (dCode === 'RECORD_NOT_UNIQUE') {
      throw createError({
        statusCode: 409,
        data: { reason: 'account_exists' },
        message: 'An account with this email already exists. Log in or reset your password to continue.',
      })
    }

    // Field validation — most commonly Directus's password policy rejecting a
    // password that cleared the client's looser check. Surface what to fix.
    if (dCode === 'FAILED_VALIDATION' || dCode === 'INVALID_PAYLOAD' || status === 400) {
      const isPassword = /password/i.test(dMsg ?? '') || /password/i.test(dErr?.extensions?.field ?? '')
      throw createError({
        statusCode: 400,
        data: { reason: isPassword ? 'weak_password' : 'invalid' },
        message: isPassword
          ? 'Your password must be at least 8 characters.'
          : dMsg
            ? `Couldn’t create your account: ${dMsg}`
            : 'Couldn’t create your account — please check your details and try again.',
      })
    }

    console.error('[register] unexpected createUser failure:', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: status === 400 ? 500 : status, message: 'Registration failed. Please try again.' })
  }
})

/**
 * Handle a registration whose email already exists on the shared instance.
 * Ownership is proven by the password — we NEVER reset it here (that would let
 * anyone seize an existing email by "registering" over it). On success we grant
 * CardDesk access if the account lacks it (e.g. an Earnest-only user) and sign
 * them in; their pending invite then redeems on landing.
 */
async function onboardExistingUser(
  event: H3Event,
  user: { id: string; role?: string | null },
  creds: { email: string; password: string },
) {
  const config = useRuntimeConfig()
  const cardDeskRole = config.public.directusRoleUser

  let result = await loginFresh(config.public.directusUrl, creds.email, creds.password)
  if (!result?.access_token) {
    // Right email, wrong password (or inactive account). Don't reveal which —
    // steer them to sign in / reset instead of overwriting the account.
    throw createError({
      statusCode: 409,
      data: { reason: 'account_exists' },
      message: 'An account with this email already exists. Log in or reset your password to continue.',
    })
  }

  const hadCardDeskRole = !!cardDeskRole && user.role === cardDeskRole
  if (!hadCardDeskRole) {
    // Add CardDesk permissions without touching their existing role. Best-effort:
    // the connection still completes via the admin token even if this fails.
    try {
      await ensureCardDeskAccess(user.id, user.role ?? null)
      // Re-login so the fresh token reflects the newly granted role/policies.
      const reauth = await loginFresh(config.public.directusUrl, creds.email, creds.password)
      if (reauth?.access_token) result = reauth
    } catch (err) {
      console.warn('[register] CardDesk access grant failed:', err)
    }
  }

  // One-time onboarding credits (idempotent via free_credits_granted).
  try { await ensureUserCredits(user.id) } catch (err) { console.warn('[register] credit grant failed:', err) }

  await establishSession(event, creds.email, result, !hadCardDeskRole)
  return { ok: true, existing: true, onboarded: !hadCardDeskRole }
}

/** Fresh, unauthenticated client login — returns the auth result or null on failure. */
async function loginFresh(directusUrl: string, email: string, password: string) {
  try {
    const client = createDirectus(directusUrl).with(authentication('json')).with(rest())
    return (await client.login({ email, password })) as any
  } catch {
    return null
  }
}

/** Fetch the profile and persist the user session. `sendWelcome` mails new/onboarded users. */
async function establishSession(event: H3Event, email: string, result: any, sendWelcome: boolean) {
  const config = useRuntimeConfig()

  let profile: Record<string, any> = {}
  try {
    profile = await fetchUserProfile(result.access_token)
  } catch (err) {
    console.error('[register] Failed to fetch user profile:', err)
  }

  await setUserSession(event, {
    user: {
      email,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires: result.expires,
      expires_at: Date.now() + (result.expires ?? 900000),
      profile,
    },
    loggedInAt: Date.now(),
  })

  // Welcome / confirm-email message. Fire-and-forget — a mail outage must not
  // break signup (the account exists + the user is logged in).
  if (sendWelcome) {
    try {
      const { subject, html, text } = await welcomeEmail({
        firstName: profile.first_name || null,
        appUrl: config.public.appUrl,
      })
      await sendEmail({ to: email, subject, html, text, emailName: 'welcome' })
    } catch (err) {
      console.warn('[register] welcome email failed:', err)
    }
  }
}
