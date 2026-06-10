import { createDirectus, rest, createUser, authentication } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { fetchUserProfile } from '../../utils/profile'
import { sendEmail } from '../../utils/email-send'
import { welcomeEmail } from '../../utils/emails/welcome'
import { ensureUserCredits } from '../../utils/ai-credits'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, first_name, last_name, industry } = body

  if (!email || !password)
    throw createError({ statusCode: 400, message: 'Email and password are required' })

  const config = useRuntimeConfig()

  try {
    // Mirror the Earnest app: create the user with the static (elevated) token so
    // we can assign the CardDesk role and activate the account immediately. The
    // public /users/register endpoint can't set role/status and 400s when the
    // shared Directus instance requires them. The cd_* rows (xp, credits) are
    // created lazily on first use, so nothing else needs seeding here.
    const admin = getDirectus()

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
    const authDirectus = createDirectus(config.public.directusUrl)
      .with(authentication('json'))
      .with(rest())

    const result = await authDirectus.login({ email, password })

    if (!result?.access_token)
      throw createError({ statusCode: 500, message: 'Registration succeeded but login failed' })

    let profile: Record<string, any> = {}
    try {
      profile = await fetchUserProfile(result.access_token)
    } catch (err) {
      console.error("[register] Failed to fetch user profile:", err)
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
    // break signup (the account is already created + the user is logged in).
    try {
      const { subject, html, text } = await welcomeEmail({
        firstName: first_name || profile.first_name || null,
        appUrl: config.public.appUrl,
      })
      await sendEmail({ to: email, subject, html, text, emailName: 'welcome' })
    } catch (err) {
      console.warn('[register] welcome email failed:', err)
    }

    return { ok: true }
  } catch (err: any) {
    if (err.statusCode) throw err

    const status = err?.response?.status ?? 500
    const message =
      status === 400
        ? 'Registration failed. Email may already be in use.'
        : 'Registration failed. Please try again.'

    throw createError({ statusCode: status, message })
  }
})
