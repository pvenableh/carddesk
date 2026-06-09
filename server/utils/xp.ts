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
export async function awardServerXp(userId: string, amount: number) {
  if (!userId || !amount) return
  try {
    const admin = getDirectus()
    const rows = (await admin.request(
      readItems('cd_xp_state' as any, {
        filter: { user_created: { _eq: userId } } as any,
        sort: ['-date_created'],
        limit: 1,
        fields: ['id', 'total_xp'],
      }),
    )) as any[]
    if (rows?.length) {
      const total = (rows[0].total_xp ?? 0) + amount
      await admin.request(updateItem('cd_xp_state' as any, rows[0].id, { total_xp: total, level: levelForXp(total) } as any))
    } else {
      await admin.request(createItem('cd_xp_state' as any, { user_created: userId, total_xp: amount, level: levelForXp(amount) } as any))
    }
  } catch (err: any) {
    console.warn('[xp] awardServerXp failed:', err?.message ?? err)
  }
}
