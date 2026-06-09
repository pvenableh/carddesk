/** DELETE /api/sessions/:id — remove a saved session (own rows only, enforced by Directus). */
import { deleteItem } from '@directus/sdk'
import { getUserDirectus } from '../../utils/directus'
import { getValidToken } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const directus = getUserDirectus(token)
  try {
    await directus.request(deleteItem('cd_sessions', id))
    return { ok: true }
  } catch (err: any) {
    console.error('[DELETE /api/sessions]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to delete session' })
  }
})
