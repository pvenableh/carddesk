import { readItems, createItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { emitFeedEvent } from '../../utils/feed'

/**
 * Introduce two of your accepted connections to each other. Body: { a, b }.
 * Both must be the caller's accepted connections. Creates a pending edge
 * between them (if none exists) and emits an 'intro' feed event for the
 * introducer. The introducer's XP/intros stat is credited client-side.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const { a, b } = await readBody(event)
  if (!a || !b || a === b || a === me || b === me)
    throw createError({ statusCode: 400, message: 'Pick two different connections' })

  const admin = getDirectus()

  // Both must be my accepted connections.
  const myEdges = (await admin.request(
    readItems('cd_connections' as any, {
      filter: { status: { _eq: 'accepted' }, _or: [{ requester: { _eq: me } }, { addressee: { _eq: me } }] } as any,
      fields: ['requester', 'addressee'],
      limit: 500,
    }),
  )) as any[]
  const mine = new Set<string>()
  for (const e of myEdges) {
    const r = typeof e.requester === 'object' ? e.requester?.id : e.requester
    const ad = typeof e.addressee === 'object' ? e.addressee?.id : e.addressee
    mine.add(r === me ? ad : r)
  }
  if (!mine.has(a) || !mine.has(b))
    throw createError({ statusCode: 403, message: 'Both people must be your connections' })

  // Already linked?
  const existing = (await admin.request(
    readItems('cd_connections' as any, {
      filter: {
        _or: [
          { _and: [{ requester: { _eq: a } }, { addressee: { _eq: b } }] },
          { _and: [{ requester: { _eq: b } }, { addressee: { _eq: a } }] },
        ],
      } as any,
      fields: ['id', 'status'],
      limit: 1,
    }),
  )) as any[]
  if (existing?.[0]) return { ok: true, existing: true, status: existing[0].status }

  await admin.request(createItem('cd_connections' as any, { requester: a, addressee: b, status: 'pending' } as any))
  await emitFeedEvent(me, 'intro', {})
  return { ok: true, created: true }
})
