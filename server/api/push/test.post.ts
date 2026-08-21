/**
 * POST /api/push/test — send a push to the signed-in user's own devices.
 *
 * The one honest way to answer "is push actually working on this phone?".
 * Reaches every CardDesk subscription the account has (not just the calling
 * device) so the settings panel can report "delivered to 2 devices" — which is
 * also how a user discovers a stale subscription on a phone they replaced.
 */
import { cdPushConfigured, cdPushToUser } from '../../utils/web-push'
import { getCurrentUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)

  if (!cdPushConfigured()) {
    throw createError({ statusCode: 503, message: 'Push notifications are not configured on this server' })
  }

  const result = await cdPushToUser(userId, {
    title: 'CardDesk push is working',
    body: "That's all this was — a test. You're set up.",
    url: '/account',
    tag: 'cd-test',
    data: { kind: 'test' },
  })

  return { ok: true, ...result }
})
