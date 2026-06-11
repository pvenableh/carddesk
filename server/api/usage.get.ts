/**
 * GET /api/usage — the signed-in user's AI token usage, bucketed by
 * today / this week (Mon) / this month / lifetime. Each bucket returns
 * { tokens, credits, calls }.
 *
 * Source of truth is cd_ai_usage_logs (one row per AI call, written by
 * chargeCredits). Admin token + explicit `user` filter — these rows are
 * admin-managed, and we only ever read the caller's own.
 *
 * Bucket boundaries: the client passes its LOCAL day/week/month starts as ISO
 * instants (?today=&week=&month=) so "today" matches the user's timezone, not
 * the server's. If any are missing/invalid we fall back to UTC boundaries.
 */
import { readItems } from '@directus/sdk'
import { getDirectus } from '../utils/directus'
import { getCurrentUserId } from '../utils/auth'

interface Bucket { tokens: number; credits: number; calls: number }
const empty = (): Bucket => ({ tokens: 0, credits: 0, calls: 0 })

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const admin = getDirectus()

  const now = new Date()
  // UTC fallbacks if the client doesn't send its local boundaries.
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const utcDow = (now.getUTCDay() + 6) % 7 // 0 = Monday
  const utcMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)

  const q = getQuery(event)
  const boundary = (v: unknown, fallback: number): number => {
    if (typeof v === 'string') { const t = Date.parse(v); if (!Number.isNaN(t)) return t }
    return fallback
  }
  const todayStart = boundary(q.today, utcToday)
  const weekStart = boundary(q.week, utcToday - utcDow * 86_400_000)
  const monthStart = boundary(q.month, utcMonth)
  const earliest = Math.min(monthStart, weekStart, todayStart)

  const out = { today: empty(), week: empty(), month: empty(), lifetime: empty() }

  try {
    // Lifetime totals via a single aggregate query (cheap, no row transfer).
    const agg = (await admin.request(
      readItems('cd_ai_usage_logs' as any, {
        aggregate: { sum: ['total_tokens', 'credits_charged'], count: ['id'] },
        filter: { user: { _eq: userId } },
      } as any),
    )) as any[]
    const a = agg?.[0]
    out.lifetime = {
      tokens: Number(a?.sum?.total_tokens ?? 0),
      credits: Number(a?.sum?.credits_charged ?? 0),
      calls: Number(a?.count?.id ?? a?.count ?? 0),
    }

    // Recent rows cover today/week/month — fetch from the earliest needed boundary.
    const rows = (await admin.request(
      readItems('cd_ai_usage_logs' as any, {
        filter: { user: { _eq: userId }, date_created: { _gte: new Date(earliest).toISOString() } } as any,
        fields: ['date_created', 'total_tokens', 'credits_charged'],
        sort: ['-date_created'],
        limit: -1,
      }),
    )) as any[]

    for (const r of rows) {
      const t = Date.parse(r.date_created)
      const tok = Number(r.total_tokens ?? 0)
      const cr = Number(r.credits_charged ?? 0)
      if (t >= monthStart) { out.month.tokens += tok; out.month.credits += cr; out.month.calls++ }
      if (t >= weekStart) { out.week.tokens += tok; out.week.credits += cr; out.week.calls++ }
      if (t >= todayStart) { out.today.tokens += tok; out.today.credits += cr; out.today.calls++ }
    }
  } catch (err: any) {
    console.error('[GET /api/usage]', err?.errors ?? err?.message ?? err)
  }

  return out
})
