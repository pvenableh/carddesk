/**
 * DELETE /api/plans/:id — delete a plan and all of its tasks (own rows only).
 * Both deletes are filtered on `user` so a foreign id touches nothing.
 */
import { deleteItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const directus = getDirectus()
  try {
    await directus.request(
      deleteItems('cd_tasks', { filter: { plan: { _eq: id }, user: { _eq: userId } } } as any),
    )
    await directus.request(
      deleteItems('cd_plans', { filter: { id: { _eq: id }, user: { _eq: userId } } } as any),
    )
    return { ok: true }
  } catch (err: any) {
    console.error('[DELETE /api/plans]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to delete plan' })
  }
})
