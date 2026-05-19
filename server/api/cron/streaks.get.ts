// GET /api/cron/streaks — end-of-day nudge for users whose CardDesk
// streak is about to break.
//
// "About to break" = streak > 0 AND last_activity_date is exactly yesterday
// (UTC). If they haven't logged anything today, the next earn() in useXp.ts
// will reset the streak to 1, wiping their progress.
//
// Schedule suggestion: run once daily at ~22:00 UTC (5 PM ET / 2 PM PT).
// We don't push closer to midnight because lock-screen pings at 11:45 PM
// are user-hostile.

import { timingSafeEqual } from 'node:crypto'
import { createDirectus, readItems, rest, staticToken } from '@directus/sdk'
import { cdPushToUser } from '../../utils/web-push'

interface XpRow {
  id: string
  user_created: string | null
  streak: number | null
  last_activity_date: string | null
}

function requireCronAuth(event: any) {
  const config = useRuntimeConfig()
  const expected = (config as any).cronSecret
  if (!expected) {
    throw createError({ statusCode: 503, message: 'CRON_SECRET not configured' })
  }
  const hdrs = getRequestHeaders(event)
  const provided = (hdrs.authorization || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
}

export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const config = useRuntimeConfig()
  const directus = createDirectus<any>(config.public.directusUrl as string)
    .with(staticToken(config.directusStaticToken as string))
    .with(rest())

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)

  let rows: XpRow[] = []
  try {
    rows = (await directus.request(
      readItems('cd_xp_state' as any, {
        filter: {
          _and: [
            { streak: { _gt: 0 } },
            { last_activity_date: { _eq: yesterday } },
          ],
        } as any,
        fields: ['id', 'user_created', 'streak', 'last_activity_date'] as any,
        limit: -1,
      } as any),
    )) as any
  } catch (err: any) {
    console.error('[cron/streaks] read failed:', err?.message || err)
    throw createError({ statusCode: 500, message: 'Could not load XP state' })
  }

  let pushed = 0
  for (const row of rows) {
    if (!row.user_created) continue
    const streak = Number(row.streak || 0)
    if (streak <= 0) continue
    // Defensive: if someone's already logged today (race with the cron),
    // skip them. The query filter pre-filters but the row may have been
    // bumped between read + push.
    if (row.last_activity_date === today) continue
    void cdPushToUser(row.user_created, {
      title: `Your ${streak}-day streak ends tonight`,
      body: 'Log a quick activity to keep it alive — even a 💬 ping counts.',
      url: '/?focus=streak',
      tag: 'cd-streak',
      data: { kind: 'streak', streak },
    })
    pushed++
  }

  return { ok: true, candidates: rows.length, users_pushed: pushed }
})
