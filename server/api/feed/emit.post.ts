import { getCurrentUserId } from '../../utils/auth'
import { emitFeedEvent, FEED_TYPES } from '../../utils/feed'

/** Client-emitted activity events (level-up, badge, scan, streak). Type is allowlisted; actor is forced to the caller. */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const { type, payload } = await readBody(event)
  if (!FEED_TYPES.includes(type)) throw createError({ statusCode: 400, message: 'Unknown event type' })
  // connected/joined/intro are emitted server-side only.
  if (['connected', 'joined', 'intro'].includes(type)) throw createError({ statusCode: 400, message: 'Not allowed' })
  await emitFeedEvent(me, type, typeof payload === 'object' && payload ? payload : {})
  return { ok: true }
})
