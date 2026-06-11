/**
 * GET /api/plans — list the signed-in user's plans, each hydrated with its tasks.
 * Query: ?contact=<id> (plans for one contact) | ?status=active|done|archived.
 *
 * Uses the admin token + explicit `user` scoping (cd_plans/cd_tasks have no
 * per-policy permissions; the user field is the source of truth and every query
 * filters on it). Tasks live in a separate collection (plain uuid links, no o2m
 * relation), so we fetch them in a second query and group by plan.
 */
import { readItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

const PLAN_FIELDS = ['id', 'user', 'contact', 'title', 'status', 'source_session', 'date_created', 'date_updated']
const TASK_FIELDS = ['id', 'user', 'plan', 'contact', 'title', 'channel', 'note', 'due_at', 'status', 'completed_at', 'sort', 'source_session']

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const directus = getDirectus()
  const q = getQuery(event)

  const filter: any = { user: { _eq: userId } }
  if (q.contact) filter.contact = { _eq: String(q.contact) }
  if (q.status) filter.status = { _eq: String(q.status) }

  try {
    const plans = (await directus.request(
      readItems('cd_plans', { filter, sort: ['-date_created'], limit: 100, fields: PLAN_FIELDS }),
    )) as any[]
    if (!plans.length) return []

    const tasks = (await directus.request(
      readItems('cd_tasks', {
        filter: { user: { _eq: userId }, plan: { _in: plans.map((p) => p.id) } },
        sort: ['sort', 'due_at'],
        limit: -1,
        fields: TASK_FIELDS,
      }),
    )) as any[]

    const byPlan: Record<string, any[]> = {}
    for (const t of tasks) (byPlan[t.plan] ||= []).push(t)
    return plans.map((p) => ({ ...p, tasks: byPlan[p.id] ?? [] }))
  } catch (err: any) {
    console.error('[GET /api/plans]', err?.errors ?? err?.message ?? err)
    return []
  }
})
