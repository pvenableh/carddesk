/**
 * GET /api/tasks — list the signed-in user's tasks (admin token + `user` scope).
 *
 * Query:
 *   ?contact=<id>            tasks about one contact
 *   ?plan=<id>               tasks in one plan
 *   ?status=pending|done|skipped
 *   ?scope=agenda            pending + dated + due on/before `before` (overdue + due today).
 *                            Used by the Vibe "On deck" widget. `before` defaults to
 *                            the end of the server's current UTC day; the client should
 *                            pass its own local end-of-day for accuracy.
 *   ?before=<ISO>            agenda cutoff (see above)
 *   ?limit=<n>               default 100 (agenda caps at 50)
 */
import { readItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

const TASK_FIELDS = ['id', 'user', 'plan', 'contact', 'title', 'channel', 'note', 'due_at', 'status', 'completed_at', 'sort', 'source_session', 'date_created']

function endOfUtcDay(): string {
  const d = new Date()
  d.setUTCHours(23, 59, 59, 999)
  return d.toISOString()
}

export default defineEventHandler(async (event) => {
  const userId = await getCurrentUserId(event)
  const directus = getDirectus()
  const q = getQuery(event)

  const filter: any = { user: { _eq: userId } }
  if (q.contact) filter.contact = { _eq: String(q.contact) }
  if (q.plan) filter.plan = { _eq: String(q.plan) }
  if (q.status) filter.status = { _eq: String(q.status) }

  let sort = ['sort', 'due_at']
  let limit = Math.min(Number(q.limit) || 100, 200)

  if (q.scope === 'agenda') {
    const before = typeof q.before === 'string' && q.before ? q.before : endOfUtcDay()
    filter.status = { _eq: 'pending' }
    filter.due_at = { _nnull: true, _lte: before }
    sort = ['due_at']
    limit = 50
  }

  try {
    return await directus.request(readItems('cd_tasks', { filter, sort, limit, fields: TASK_FIELDS }))
  } catch (err: any) {
    console.error('[GET /api/tasks]', err?.errors ?? err?.message ?? err)
    return []
  }
})
