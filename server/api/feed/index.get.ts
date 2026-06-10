import { readItems, readUsers } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

/**
 * The network feed: the caller's own events + their accepted connections'
 * non-private events, newest first, with reaction tallies and whether the
 * caller has reacted. Admin-token reads; visibility enforced here.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const admin = getDirectus()

  // Accepted connections → the set of actors whose activity I can see.
  const edges = (await admin.request(
    readItems('cd_connections' as any, {
      filter: { status: { _eq: 'accepted' }, _or: [{ requester: { _eq: me } }, { addressee: { _eq: me } }] } as any,
      fields: ['requester', 'addressee'],
      limit: 500,
    }),
  )) as any[]
  const actorIds = new Set<string>([me])
  for (const e of edges) {
    actorIds.add(typeof e.requester === 'object' ? e.requester?.id : e.requester)
    actorIds.add(typeof e.addressee === 'object' ? e.addressee?.id : e.addressee)
  }

  const events = (await admin.request(
    readItems('cd_feed_events' as any, {
      filter: {
        actor: { _in: Array.from(actorIds) },
        _or: [{ actor: { _eq: me } }, { visibility: { _neq: 'private' } }],
      } as any,
      fields: ['id', 'type', 'payload', 'date_created', { actor: ['id', 'first_name', 'last_name'] }] as any,
      sort: ['-date_created'],
      limit: 60,
    }),
  )) as any[]

  if (!events.length) return { events: [] }

  const ids = events.map((e) => e.id)
  const reactions = (await admin.request(
    readItems('cd_reactions' as any, {
      filter: { event: { _in: ids } } as any,
      fields: ['event', 'emoji', 'user'],
      limit: 2000,
    }),
  )) as any[]

  // Resolve reactor names for the who-reacted tooltip (self shows as "You").
  const reactorIds = Array.from(
    new Set(reactions.map((r) => (typeof r.user === 'object' ? r.user?.id : r.user)).filter(Boolean)),
  ).filter((id) => id !== me)
  const names: Record<string, string> = {}
  if (reactorIds.length) {
    const users = (await admin.request(
      readUsers({ filter: { id: { _in: reactorIds } } as any, fields: ['id', 'first_name', 'last_name'], limit: 1000 }),
    )) as any[]
    for (const u of users) names[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'CardDesk user'
  }

  const byEvent: Record<
    string,
    { counts: Record<string, number>; mine: string[]; who: Record<string, string[]> }
  > = {}
  for (const r of reactions) {
    const ev = typeof r.event === 'object' ? r.event?.id : r.event
    const u = typeof r.user === 'object' ? r.user?.id : r.user
    const slot = (byEvent[ev] ??= { counts: {}, mine: [], who: {} })
    slot.counts[r.emoji] = (slot.counts[r.emoji] ?? 0) + 1
    const label = u === me ? 'You' : names[u] ?? 'CardDesk user'
    const who = (slot.who[r.emoji] ??= [])
    // Keep "You" first in the tooltip list.
    if (u === me) who.unshift(label)
    else who.push(label)
    if (u === me) slot.mine.push(r.emoji)
  }

  return {
    events: events.map((e) => {
      const a = e.actor
      return {
        id: e.id,
        type: e.type,
        payload: e.payload ?? {},
        date: e.date_created,
        mine: (a?.id ?? a) === me,
        actor: { id: a?.id ?? a, name: [a?.first_name, a?.last_name].filter(Boolean).join(' ') || 'CardDesk user' },
        reactions: byEvent[e.id]?.counts ?? {},
        myReactions: byEvent[e.id]?.mine ?? [],
        reactionUsers: byEvent[e.id]?.who ?? {},
      }
    }),
  }
})
