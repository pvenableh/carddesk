/**
 * GET /api/sessions — list the signed-in user's saved sessions.
 * Query: ?contact=<id> (client-specific) or ?scope=general (no contact).
 */
import { readItems } from '@directus/sdk'
import { getUserDirectus } from '../../utils/directus'
import { getValidToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event)
  const directus = getUserDirectus(token)
  const q = getQuery(event)

  const filter: any = { user_created: { _eq: '$CURRENT_USER' } }
  if (q.contact) filter.contact = { _eq: String(q.contact) }
  else if (q.scope === 'general') filter.contact = { _null: true }

  try {
    return await directus.request(
      readItems('cd_sessions', {
        filter,
        sort: ['-is_pinned', '-date_created'],
        limit: 50,
        fields: ['id', 'contact', 'type', 'title', 'summary', 'messages', 'is_pinned', 'date_created'],
      }),
    )
  } catch (err: any) {
    console.error('[GET /api/sessions]', err?.errors ?? err?.message ?? err)
    return []
  }
})
