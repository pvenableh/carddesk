/**
 * PATCH /api/plans/:id — update a plan's title or status (own rows only).
 * Ownership is enforced by filtering the write on { id, user } so a foreign id
 * is a no-op rather than an error.
 * Body: { title?, status? }
 */
import { updateItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const body = await readBody(event)
  const patch: Record<string, any> = {}
  if (typeof body?.title === 'string') patch.title = body.title.slice(0, 160)
  if (['active', 'done', 'archived'].includes(body?.status)) patch.status = body.status
  if (!Object.keys(patch).length) throw createError({ statusCode: 400, message: 'Nothing to update' })

  const directus = getDirectus()
  try {
    const updated = (await directus.request(
      updateItems('cd_plans', { filter: { id: { _eq: id }, user: { _eq: userId } } }, patch as any),
    )) as any[]
    if (!updated?.length) throw createError({ statusCode: 404, message: 'Plan not found' })
    return updated[0]
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[PATCH /api/plans]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to update plan' })
  }
})
