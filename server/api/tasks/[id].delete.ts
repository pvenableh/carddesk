/**
 * DELETE /api/tasks/:id — delete a task (own rows only; filtered on `user`).
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
      deleteItems('cd_tasks', { filter: { id: { _eq: id }, user: { _eq: userId } } } as any),
    )
    return { ok: true }
  } catch (err: any) {
    console.error('[DELETE /api/tasks]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to delete task' })
  }
})
