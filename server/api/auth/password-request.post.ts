import { randomBytes } from 'node:crypto'
import { readUsers, createItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { sendEmail } from '../../utils/email-send'
import { passwordResetEmail } from '../../utils/emails/password-reset'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Custom password-reset request. Instead of Directus's built-in passwordRequest
 * (which sends Directus's own un-styled email and needs the instance's SMTP
 * configured), we mint our own single-use token in `password_reset_tokens` and
 * send a fully CardDesk-branded email via SendGrid. The reset link lands on
 * /auth/reset-password?token=… and is consumed by password-reset.post.ts.
 *
 * Always returns { ok: true } regardless of whether the email exists, to avoid
 * leaking which addresses have accounts (enumeration).
 */
export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)
  if (!email || typeof email !== 'string')
    throw createError({ statusCode: 400, message: 'Email is required' })

  const normalized = email.trim().toLowerCase()
  const config = useRuntimeConfig()

  try {
    const admin = getDirectus()

    const users = (await admin.request(
      readUsers({
        filter: { email: { _eq: normalized } } as any,
        fields: ['id', 'first_name', 'email'],
        limit: 1,
      }),
    )) as any[]

    const user = users?.[0]
    if (!user) {
      console.info('[password-request] no user for', normalized, '— silent ok')
      return { ok: true }
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
    const requestedIp =
      getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      getRequestIP(event) ||
      null

    await admin.request(
      createItem('password_reset_tokens' as any, {
        user: user.id,
        token,
        expires_at: expiresAt,
        requested_ip: requestedIp,
      } as any),
    )

    const resetUrl = `${config.public.appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`
    const { subject, html, text } = passwordResetEmail({
      firstName: user.first_name,
      resetUrl,
    })

    await sendEmail({ to: user.email, subject, html, text, emailName: 'password-reset' })

    return { ok: true }
  } catch (err: any) {
    // Never surface internals; keep the response opaque.
    console.error('[password-request] error:', err?.errors ?? err?.message ?? err)
    return { ok: true }
  }
})
