// POST /api/cron/follow-ups — daily nudge for users with overdue hot
// follow-ups. Auth-gated with a shared CRON_SECRET; intended to be hit by
// Vercel Cron or any external scheduler.
//
// Heuristic mirrors the client-side followUpStatus() in useContacts.ts:
//   "overdue" = last activity > 10 days ago AND the last activity was NOT
//   a response (i.e. WE're the ones who owe a touch).
//
// Limited to rating='hot' AND hibernated=false, then grouped by user.
// One push per user summarizing the count + the most-overdue name.

import { createDirectus, readItems, rest, staticToken } from '@directus/sdk'
import { cdPushToUser } from '../../utils/web-push'

interface CdContactRow {
  id: string
  name: string
  user_created: string | null
  rating: string | null
  hibernated: boolean | null
  activities: Array<{ id: string; type: string; date: string; is_response: boolean | null }> | null
}

function requireCronAuth(event: any) {
  const config = useRuntimeConfig()
  const expected = (config as any).cronSecret
  if (!expected) {
    throw createError({ statusCode: 503, message: 'CRON_SECRET not configured' })
  }
  const hdrs = getRequestHeaders(event)
  const provided = (hdrs.authorization || '').replace(/^Bearer\s+/i, '')
  if (provided !== expected) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
}

export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const config = useRuntimeConfig()
  const directus = createDirectus<any>(config.public.directusUrl as string)
    .with(staticToken(config.directusStaticToken as string))
    .with(rest())

  let rows: CdContactRow[] = []
  try {
    rows = (await directus.request(
      readItems('cd_contacts' as any, {
        filter: {
          _and: [{ rating: { _eq: 'hot' } }, { hibernated: { _eq: false } }],
        } as any,
        fields: [
          'id',
          'name',
          'user_created',
          'rating',
          'hibernated',
          { activities: ['id', 'type', 'date', 'is_response'] },
        ] as any,
        limit: -1,
      } as any),
    )) as any
  } catch (err: any) {
    console.error('[cron/follow-ups] read failed:', err?.message || err)
    throw createError({ statusCode: 500, message: 'Could not load contacts' })
  }

  const now = Date.now()
  const overdueByUser = new Map<string, CdContactRow[]>()

  for (const row of rows) {
    if (!row.user_created) continue
    const acts = row.activities || []
    if (!acts.length) continue
    const sorted = [...acts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    const last = sorted[0]!
    const days = Math.floor((now - new Date(last.date).getTime()) / 86_400_000)
    if (days < 10) continue
    if (last.is_response) continue
    const bucket = overdueByUser.get(row.user_created) || []
    bucket.push(row)
    overdueByUser.set(row.user_created, bucket)
  }

  let pushed = 0
  for (const [userId, list] of overdueByUser) {
    const count = list.length
    const first = list[0]!.name
    const tail = count > 1 ? ` and ${count - 1} more` : ''
    void cdPushToUser(userId, {
      title: count === 1 ? 'Hot contact needs a follow-up' : `${count} hot contacts need follow-ups`,
      body: `${first}${tail} — last touch over 10 days ago.`,
      url: '/?filter=overdue',
      tag: 'cd-follow-ups',
      data: { kind: 'follow_ups', count },
    })
    pushed++
  }

  return { ok: true, scanned: rows.length, users_pushed: pushed }
})
