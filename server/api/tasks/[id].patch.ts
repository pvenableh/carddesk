/**
 * PATCH /api/tasks/:id — update a task (own rows only; write filtered on { id, user }).
 * Body: { title?, channel?, note?, due_at?, status?, sort?, plan? }
 *
 * Toggling status stamps/clears completed_at so the agenda + widgets stay honest
 * without the client having to manage it.
 *
 * Plan auto-completion: when a status change leaves the parent plan with no
 * pending tasks, the plan flips to `done` (and back to `active` if a task is
 * reopened). Doing this server-side keeps every surface — the contact widget,
 * the Vibe agenda, the Plans board — consistent no matter which one toggled the
 * task. The response carries `planCompleted`/`planStatus` so the client can fire
 * the celebration without a second round-trip.
 */
import { readItems, updateItems } from '@directus/sdk'
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
  const statusChanged = STATUSES.includes(body?.status)
  if (statusChanged) {
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
    const task = updated[0]

    // Recompute the parent plan's completion whenever a status moved. A plan is
    // "done" once it has tasks and none are still pending (done or skipped); it
    // reopens the moment a task goes back to pending.
    let planCompleted = false
    let planStatus: string | null = null
    if (statusChanged && task.plan) {
      planStatus = await syncPlanStatus(directus, userId, task.plan)
      planCompleted = planStatus === 'done' && body.status === 'done'
    }

    return { ...task, planCompleted, planStatus }
  } catch (err: any) {
    if (err?.statusCode) throw err
    console.error('[PATCH /api/tasks]', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Failed to update task' })
  }
})

/** Flip a plan between active/done based on its tasks; returns the resulting status. */
async function syncPlanStatus(directus: any, userId: string, planId: string): Promise<string | null> {
  const [plan] = (await directus.request(
    readItems('cd_plans', { filter: { id: { _eq: planId }, user: { _eq: userId } }, fields: ['id', 'status'], limit: 1 }),
  )) as any[]
  if (!plan) return null
  // Archived plans are a deliberate, manual state — never auto-touch them.
  if (plan.status === 'archived') return plan.status

  const tasks = (await directus.request(
    readItems('cd_tasks', { filter: { plan: { _eq: planId }, user: { _eq: userId } }, fields: ['status'], limit: -1 }),
  )) as any[]
  if (!tasks.length) return plan.status

  const nonePending = tasks.every((t) => t.status !== 'pending')
  const anyDone = tasks.some((t) => t.status === 'done')
  const next = nonePending && anyDone ? 'done' : 'active'
  if (next !== plan.status) {
    await directus.request(updateItems('cd_plans', { filter: { id: { _eq: planId }, user: { _eq: userId } } }, { status: next } as any))
  }
  return next
}
