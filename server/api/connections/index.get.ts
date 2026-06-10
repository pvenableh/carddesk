import { readItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { getAvatarUrls } from '../../utils/cards'

/**
 * Lists the current user's network: accepted connections + any pending
 * requests (incoming or outgoing). Ownership is enforced server-side — we only
 * ever return rows where the caller is the requester or addressee. Uses the
 * admin client (cd_connections has no per-user role policy; the server is the
 * gatekeeper, same pattern as cd_credit_accounts).
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const admin = getDirectus()

  const USER_FIELDS = ['id', 'first_name', 'last_name', 'title', 'avatar', 'industry']

  const rows = (await admin.request(
    readItems('cd_connections' as any, {
      filter: {
        _or: [{ requester: { _eq: me } }, { addressee: { _eq: me } }],
        status: { _neq: 'declined' },
      } as any,
      fields: ['id', 'status', 'date_created', 'date_updated', { requester: USER_FIELDS }, { addressee: USER_FIELDS }] as any,
      sort: ['-date_updated'],
      limit: 500,
    }),
  )) as any[]

  const otherIds = rows
    .map((r) => {
      const iAmRequester = (r.requester?.id ?? r.requester) === me
      const other = iAmRequester ? r.addressee : r.requester
      return other?.id ?? other
    })
    .filter(Boolean) as string[]
  // Resolve avatars for everyone (+ me, for the orbit centre) in one batch.
  const avatars = await getAvatarUrls([...otherIds, me])

  // Each connected user's CardDesk activity (XP) — drives the orbit's
  // "most active = front/large" depth ranking. Same read as the leaderboard.
  const xpRows = otherIds.length
    ? ((await admin.request(
        readItems('cd_xp_state' as any, {
          filter: { user_created: { _in: otherIds } } as any,
          fields: ['user_created', 'total_xp', 'week_xp', 'level', 'last_activity_date'] as any,
          limit: 1000,
        }),
      )) as any[])
    : []
  const xpByUser: Record<string, any> = {}
  for (const x of xpRows) xpByUser[x.user_created] = x

  const connections = rows.map((r) => {
    const iAmRequester = (r.requester?.id ?? r.requester) === me
    const other = iAmRequester ? r.addressee : r.requester
    const otherId = other?.id ?? other
    const xp = xpByUser[otherId] ?? {}
    return {
      id: r.id,
      status: r.status as string,
      // For pending rows the UI needs to know which way it points.
      direction: r.status === 'pending' ? (iAmRequester ? 'outgoing' : 'incoming') : null,
      since: r.date_created,
      // When the connection last changed — a recency signal for the orbit.
      updated: r.date_updated ?? r.date_created,
      user: other && typeof other === 'object'
        ? {
            id: other.id,
            name: [other.first_name, other.last_name].filter(Boolean).join(' ') || 'CardDesk user',
            title: other.title ?? null,
            avatarUrl: avatars[otherId] ?? null,
            industry: other.industry ?? null,
            level: xp.level ?? 1,
            totalXp: xp.total_xp ?? 0,
            weekXp: xp.week_xp ?? 0,
            lastActivityDate: xp.last_activity_date ?? null,
          }
        : {
            id: otherId, name: 'CardDesk user', title: null, avatarUrl: avatars[otherId] ?? null,
            industry: null, level: 1, totalXp: 0, weekXp: 0, lastActivityDate: null,
          },
    }
  })

  return { connections, me: { avatarUrl: avatars[me] ?? null } }
})
