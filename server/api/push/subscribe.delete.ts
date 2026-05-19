// DELETE /api/push/subscribe — remove the caller's subscription by endpoint.

import { createDirectus, deleteItems, readItems, rest, staticToken } from '@directus/sdk'
import { getCurrentUserId } from '../../utils/auth'

interface UnsubBody { endpoint?: string }

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const body = (await readBody<UnsubBody>(event)) || {}
  const endpoint = body.endpoint
  if (!endpoint) {
    throw createError({ statusCode: 400, message: 'endpoint required' })
  }

  const config = useRuntimeConfig()
  const directus = createDirectus<any>(config.public.directusUrl as string)
    .with(staticToken(config.directusStaticToken as string))
    .with(rest())

  try {
    const rows = (await directus.request(
      readItems('push_subscriptions' as any, {
        filter: {
          _and: [{ endpoint: { _eq: endpoint } }, { user: { _eq: userId } }],
        } as any,
        fields: ['id'] as any,
        limit: 1,
      } as any),
    )) as any[]
    const id = rows?.[0]?.id
    if (!id) return { deleted: false }
    await directus.request(deleteItems('push_subscriptions' as any, [id]))
    return { deleted: true }
  } catch (err: any) {
    console.error('[push/subscribe.delete] failed:', err?.message || err)
    throw createError({ statusCode: 500, message: 'Could not remove subscription' })
  }
})
