/**
 * PATCH /api/tasks/:id — update a task (own rows only; write filtered on { id, user }).
 * Body: { title?, channel?, note?, due_at?, status?, sort?, plan? }
 *
 * Toggling status stamps/clears completed_at so the agenda + widgets stay honest
 * without the client having to manage it.
 */
import { updateItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

const CHANNELS = ['email', 'linkedin', 'call', 'meet', 'other']
const STATUSES = ['pending', 'done', 'skipped']

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const body = await readBody(event)
  const patch: Record<string, any> = {}
  if (typeof body?.title === 'string') patch.title = body.title.slice(0, 200)
  if (body?.channel === null || CHANNELS.includes(body?.channel)) patch.channel = body.channel ?? null
  if (typeof body?.note === 'string' || body?.note === null) patch.note = body.note ?? null
  if (body?.due_at === null || typeof body?.due_at === 'string') patch.due_at = body.due_at ?? null
  if (Number.isFinite(body?.sort)) patch.sort = body.sort
  if (body?.plan === null || typeof body?.plan === 'string') patch.plan = body.plan ?? null
  if (STATUSES.includes(body?.status)) {
    patch.status = body.status
    patch.completed_at = body.status === 'done' ? new Date().toISOString() : null
  }
  if (!Object.keys(patch).length) throw createError({ statusCode: 400, message: 'Nothing to update' })

  const directus = getDirectus()
  try {
    const updated = (await directus.request(
      updateItems('cd_tasks', { filter: { id: { _eq: id }, user: { _eq: userId } } }, patch as any),
    )) as any[]
    if (!updated?.length) throw createError({ statusCode: 404, message: 'Task not found' })
    return updated[0]
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[PATCH /api/tasks]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to update task' })
  }
})
