// POST /api/push/subscribe — upsert a push subscription for the signed-in
// CardDesk user. Same shape as Earnest's matching route, writes to the
// shared `push_subscriptions` collection on the shared Directus instance.

import { createItem, createDirectus, readItems, rest, staticToken, updateItem } from '@directus/sdk'
import { getCurrentUserId } from '../../utils/auth'

interface SubscribeBody {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
  origin?: string
  user_agent?: string
}

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)

  const body = (await readBody<SubscribeBody>(event)) || {}
  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    throw createError({ statusCode: 400, message: 'endpoint + keys.p256dh + keys.auth required' })
  }

  const hdrs = getRequestHeaders(event)
  const origin =
    body.origin ||
    hdrs.origin ||
    (hdrs.host ? `https://${hdrs.host}` : '') ||
    'unknown'
  const userAgent = body.user_agent || hdrs['user-agent'] || null

  const config = useRuntimeConfig()
  const directus = createDirectus<any>(config.public.directusUrl as string)
    .with(staticToken(config.directusStaticToken as string))
    .with(rest())

  let existing: any = null
  try {
    const rows = (await directus.request(
      readItems('push_subscriptions' as any, {
        filter: { endpoint: { _eq: endpoint } } as any,
        fields: ['id', 'user'] as any,
        limit: 1,
      } as any),
    )) as any[]
    existing = rows?.[0] || null
  } catch (err) {
    console.error('[push/subscribe] lookup failed:', err)
  }

  try {
    if (existing) {
      await directus.request(
        updateItem('push_subscriptions' as any, existing.id, {
          user: userId,
          origin,
          p256dh,
          auth,
          user_agent: userAgent,
        } as any),
      )
      return { id: existing.id, upserted: true }
    }
    const created: any = await directus.request(
      createItem('push_subscriptions' as any, {
        user: userId,
        origin,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
      } as any),
    )
    return { id: created?.id, upserted: false }
  } catch (err: any) {
    console.error('[push/subscribe] write failed:', err?.message || err)
    throw createError({ statusCode: 500, message: 'Could not save subscription' })
  }
})
