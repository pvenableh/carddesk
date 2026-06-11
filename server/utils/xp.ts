import { readItems, updateItem, createItem } from '@directus/sdk'
import { getDirectus } from './directus'

// XP thresholds per level (index = level - 1). Mirrors LEVELS in useXp.ts.
const LEVEL_XP = [0, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]

function levelForXp(xp: number): number {
  let lvl = 1
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) if (xp >= LEVEL_XP[i]) { lvl = i + 1; break }
  return lvl
}

/**
 * Credit XP to a user server-side — used when the recipient may be offline
 * (e.g. the inviter when their link converts, or the requester when their
 * connection is accepted). Updates their cd_xp_state row (recomputing level);
 * their client picks it up on the next loadXp. Best-effort.
 *
 * Note: cd_xp_state is scoped by `user_created`. We can reliably UPDATE an
 * existing row; creating one for a user who's never earned XP relies on the
 * admin token being allowed to set user_created (falls through quietly if not).
 */
export async function awardServerXp(userId: string, amount: number, counters?: Record<string, number>) {
  if (!userId || (!amount && !counters)) return
  try {
    const admin = getDirectus()
    // Optional counter fields (e.g. { invites_accepted: 1 }) are read alongside
    // total_xp and incremented in the same write — one round-trip, no clobber.
    const counterKeys = counters ? Object.keys(counters) : []
    const rows = (await admin.request(
      readItems('cd_xp_state' as any, {
        filter: { user_created: { _eq: userId } } as any,
        sort: ['-date_created'],
        limit: 1,
        fields: ['id', 'total_xp', ...counterKeys],
      }),
    )) as any[]
    if (rows?.length) {
      const total = (rows[0].total_xp ?? 0) + amount
      const patch: Record<string, any> = { total_xp: total, level: levelForXp(total) }
      for (const k of counterKeys) patch[k] = (rows[0][k] ?? 0) + (counters![k] ?? 0)
      await admin.request(updateItem('cd_xp_state' as any, rows[0].id, patch as any))
    } else {
      const patch: Record<string, any> = { user_created: userId, total_xp: amount, level: levelForXp(amount) }
      for (const k of counterKeys) patch[k] = counters![k]
      await admin.request(createItem('cd_xp_state' as any, patch as any))
    }
  } catch (err: any) {
    console.warn('[xp] awardServerXp failed:', err?.message ?? err)
  }
}
