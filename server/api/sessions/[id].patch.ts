/**
 * PATCH /api/sessions/:id — update a saved session (own rows only, enforced by
 * Directus via the user token). Used to append turns to a continuable chat
 * session and to refresh its summary/title or pin state.
 * Body: { messages?, summary?, title?, is_pinned? }
 */
import { updateItem } from '@directus/sdk'
import { getUserDirectus } from '../../utils/directus'
import { getValidToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const body = await readBody(event)
  const patch: Record<string, any> = {}
  if (Array.isArray(body?.messages)) patch.messages = body.messages
  if (typeof body?.summary === 'string') patch.summary = body.summary
  if (typeof body?.title === 'string') patch.title = body.title
  if (typeof body?.is_pinned === 'boolean') patch.is_pinned = body.is_pinned
  if (!Object.keys(patch).length)
    throw createError({ statusCode: 400, message: 'Nothing to update' })

  const directus = getUserDirectus(token)
  try {
    return await directus.request(updateItem('cd_sessions', id, patch as any))
  } catch (err: any) {
    console.error('[PATCH /api/sessions]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to update session' })
  }
})
