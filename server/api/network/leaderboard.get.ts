import { readItems, readUsers } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { getAvatarUrls } from '../../utils/cards'

/** Monday (YYYY-MM-DD) of the current week — matches useXp's week bucket. */
function weekStartStr(): string {
  const x = new Date()
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x.toISOString().slice(0, 10)
}

/**
 * Ranks the caller + their accepted connections. `?window=all` (default) uses
 * total XP; `?window=week` uses XP earned this ISO week (cd_xp_state.week_xp,
 * counted only when week_start is the current week). Users without an XP row
 * default to 0 / level 1.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const window = String(getQuery(event).window || 'all') === 'week' ? 'week' : 'all'
  const wk = weekStartStr()
  const admin = getDirectus()

  const edges = (await admin.request(
    readItems('cd_connections' as any, {
      filter: { status: { _eq: 'accepted' }, _or: [{ requester: { _eq: me } }, { addressee: { _eq: me } }] } as any,
      fields: ['requester', 'addressee'],
      limit: 500,
    }),
  )) as any[]
  const ids = new Set<string>([me])
  for (const e of edges) {
    ids.add(typeof e.requester === 'object' ? e.requester?.id : e.requester)
    ids.add(typeof e.addressee === 'object' ? e.addressee?.id : e.addressee)
  }
  const userIds = Array.from(ids)

  const xpRows = (await admin.request(
    readItems('cd_xp_state' as any, {
      filter: { user_created: { _in: userIds } } as any,
      fields: ['user_created', 'total_xp', 'level', 'week_xp', 'week_start'],
      limit: 1000,
    }),
  )) as any[]
  const byUser: Record<string, { total: number; level: number; week: number }> = {}
  for (const r of xpRows) {
    const u = typeof r.user_created === 'object' ? r.user_created?.id : r.user_created
    const weekly = r.week_start && String(r.week_start).slice(0, 10) === wk ? (r.week_xp ?? 0) : 0
    const cur = byUser[u]
    if (!cur) byUser[u] = { total: r.total_xp ?? 0, level: r.level ?? 1, week: weekly }
    else {
      if ((r.total_xp ?? 0) > cur.total) { cur.total = r.total_xp ?? 0; cur.level = r.level ?? 1 }
      cur.week = Math.max(cur.week, weekly)
    }
  }

  const users = (await admin.request(
    readUsers({ filter: { id: { _in: userIds } } as any, fields: ['id', 'first_name', 'last_name'], limit: 1000 }),
  )) as any[]
  const nameById: Record<string, string> = {}
  for (const u of users) nameById[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'CardDesk user'

  const avatars = await getAvatarUrls(userIds)
  const entries = userIds
    .map((id) => ({
      id,
      name: nameById[id] ?? 'CardDesk user',
      xp: window === 'week' ? (byUser[id]?.week ?? 0) : (byUser[id]?.total ?? 0),
      level: byUser[id]?.level ?? 1,
      avatarUrl: avatars[id] ?? null,
      isMe: id === me,
    }))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const myRank = entries.find((e) => e.isMe)?.rank ?? null
  return { entries, myRank, total: entries.length, window }
})
