import { readItems, updateItem, updateUser } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'

/**
 * Consume a single-use reset token minted by password-request.post.ts, set the
 * new password via the admin client, and burn the token. Tokens live in
 * `password_reset_tokens` (shared with the Earnest app on the same Directus).
 */
export default defineEventHandler(async (event) => {
  const { token, password } = await readBody(event)

  if (!token || typeof token !== 'string')
    throw createError({ statusCode: 400, message: 'Token is required' })
  if (!password || typeof password !== 'string' || password.length < 8)
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })

  const admin = getDirectus()

  const rows = (await admin
    .request(
      readItems('password_reset_tokens' as any, {
        filter: { token: { _eq: token } } as any,
        fields: ['id', 'user', 'expires_at', 'used_at'],
        limit: 1,
      }),
    )
    .catch(() => [])) as any[]

  const row = rows?.[0]
  if (!row)
    throw createError({ statusCode: 400, message: 'Invalid or expired reset link' })
  if (row.used_at)
    throw createError({ statusCode: 400, message: 'This reset link has already been used. Request a new one.' })
  if (new Date(row.expires_at).getTime() < Date.now())
    throw createError({ statusCode: 400, message: 'This reset link has expired. Request a new one.' })

  const userId = typeof row.user === 'object' ? row.user?.id : row.user
  if (!userId)
    throw createError({ statusCode: 500, message: 'Reset record is corrupt — request a new link.' })

  try {
    await admin.request(updateUser(userId, { password } as any))
  } catch (err: any) {
    console.error('[password-reset] failed to set password:', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: 500, message: 'Could not reset password. Please try again.' })
  }

  // Burn the token. Best-effort: the password is already changed, so a failure
  // here shouldn't 500 the user.
  await admin
    .request(updateItem('password_reset_tokens' as any, row.id, { used_at: new Date().toISOString() } as any))
    .catch((err: any) => console.warn('[password-reset] failed to burn token:', err?.message ?? err))

  return { ok: true }
})
