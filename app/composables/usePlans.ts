import type { CdPlan, CdTask, TaskChannel } from '~/types/directus'

/**
 * Plans & tasks — the "plan of attack" layer.
 *
 * A plan (cd_plans) is a thin, named grouping; tasks (cd_tasks) are the durable,
 * checkable units that carry due dates. Plans are usually born from an Earnest
 * chat reply via extractPlan() → a review sheet → createPlan(). The same tasks
 * power the contact widget and the Vibe "On deck" agenda.
 */

export interface ExtractedTask {
  title: string
  channel?: TaskChannel | null
  offset_days: number
  note?: string | null
}

export interface ExtractedPlan {
  is_plan: boolean
  title: string
  anchor: string
  tasks: ExtractedTask[]
}

/** A task shaped for the review sheet / create payload (resolved due date). */
export interface DraftTask {
  title: string
  channel?: TaskChannel | null
  note?: string | null
  due_at?: string | null
  sort?: number
}

export interface CreatePlanInput {
  title: string
  contact?: string | null
  status?: CdPlan['status']
  source_session?: string | null
  tasks?: DraftTask[]
}

export interface DueMeta { label: string; overdue: boolean; today: boolean; soon: boolean }

/** Human due-date label + urgency flags, used by the contact widget + Vibe agenda. */
export function dueMeta(iso?: string | null): DueMeta {
  if (!iso) return { label: 'No date', overdue: false, today: false, soon: false }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { label: 'No date', overdue: false, today: false, soon: false }
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayMs = 86_400_000
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((dueDay.getTime() - startOfToday.getTime()) / dayMs)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  let label: string
  if (diffDays < 0) label = diffDays === -1 ? 'Yesterday' : `${Math.abs(diffDays)}d overdue`
  else if (diffDays === 0) label = `Today · ${time}`
  else if (diffDays === 1) label = `Tomorrow · ${time}`
  else if (diffDays < 7) label = d.toLocaleDateString([], { weekday: 'short' })
  else label = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return { label, overdue: diffDays < 0, today: diffDays === 0, soon: diffDays >= 0 && diffDays <= 2 }
}

/** anchor "YYYY-MM-DD" + whole-day offset → an ISO due date at 9am local time. */
export function offsetToDueAt(anchorYmd: string, offsetDays: number): string {
  const [y, m, d] = anchorYmd.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + (Number.isFinite(offsetDays) ? offsetDays : 0))
  dt.setHours(9, 0, 0, 0)
  return dt.toISOString()
}

export function usePlans() {
  const { error: showError } = useToast()
  const { loadCredits } = useCredits()

  // Cross-component refresh signal: bumped after any plan/task mutation so widgets
  // on other screens (contact detail, Vibe agenda) reload without prop wiring.
  const dirty = useState('cd-plans-dirty', () => 0)
  const bump = () => { dirty.value++ }

  // ─── Plans ────────────────────────────────────────────────────────────────
  async function listPlans(opts: { contact?: string; status?: CdPlan['status'] } = {}) {
    const query: Record<string, string> = {}
    if (opts.contact) query.contact = opts.contact
    if (opts.status) query.status = opts.status
    return await $fetch<CdPlan[]>('/api/plans', { query })
  }

  async function createPlan(input: CreatePlanInput) {
    const plan = await $fetch<CdPlan>('/api/plans', { method: 'POST', body: input })
    bump()
    return plan
  }

  async function updatePlan(id: string, patch: { title?: string; status?: CdPlan['status'] }) {
    const plan = await $fetch<CdPlan>(`/api/plans/${id}`, { method: 'PATCH', body: patch })
    bump()
    return plan
  }

  async function deletePlan(id: string) {
    const res = await $fetch(`/api/plans/${id}`, { method: 'DELETE' })
    bump()
    return res
  }

  // ─── Tasks ────────────────────────────────────────────────────────────────
  async function listTasks(
    opts: { contact?: string; plan?: string; status?: CdTask['status']; scope?: 'agenda'; before?: string; limit?: number } = {},
  ) {
    const query: Record<string, string> = {}
    if (opts.contact) query.contact = opts.contact
    if (opts.plan) query.plan = opts.plan
    if (opts.status) query.status = opts.status
    if (opts.scope) query.scope = opts.scope
    if (opts.before) query.before = opts.before
    if (opts.limit) query.limit = String(opts.limit)
    return await $fetch<CdTask[]>('/api/tasks', { query })
  }

  /** Tasks due on/before the end of *today* (local) plus anything overdue — the agenda. */
  async function listAgenda() {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    return await listTasks({ scope: 'agenda', before: end.toISOString() })
  }

  async function createTask(input: DraftTask & { contact?: string | null; plan?: string | null }) {
    const task = await $fetch<CdTask>('/api/tasks', { method: 'POST', body: input })
    bump()
    return task
  }

  async function updateTask(
    id: string,
    patch: Partial<Pick<CdTask, 'title' | 'channel' | 'note' | 'due_at' | 'status' | 'sort' | 'plan'>>,
  ) {
    const task = await $fetch<CdTask>(`/api/tasks/${id}`, { method: 'PATCH', body: patch })
    bump()
    return task
  }

  async function setTaskStatus(id: string, status: CdTask['status']) {
    return await updateTask(id, { status })
  }

  async function deleteTask(id: string) {
    const res = await $fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    bump()
    return res
  }

  // ─── AI extraction ──────────────────────────────────────────────────────
  /**
   * Ask Earnest to turn a chat reply into a structured plan. Metered (1 credit).
   * Returns the extracted plan with offset-based timing; resolveDrafts() turns
   * those offsets into concrete due dates for the review sheet.
   */
  async function extractPlan(opts: {
    message: string
    contactId?: string | null
    contactName?: string | null
    sessionId?: string | null
    anchor?: string
  }): Promise<ExtractedPlan | null> {
    try {
      const result = await $fetch<ExtractedPlan>('/api/ai-extract-plan', { method: 'POST', body: opts })
      loadCredits()
      return result
    } catch (err: any) {
      if (err?.statusCode === 402 || err?.response?.status === 402) {
        // credit-guard plugin opens the buy modal; no extra toast.
        return null
      }
      showError(err?.data?.message || 'Couldn’t build a plan — try again.')
      return null
    }
  }

  /** Resolve an extracted plan's offsets into editable draft tasks with due dates. */
  function resolveDrafts(plan: ExtractedPlan): DraftTask[] {
    return plan.tasks.map((t, i) => ({
      title: t.title,
      channel: t.channel ?? null,
      note: t.note ?? null,
      due_at: offsetToDueAt(plan.anchor, t.offset_days),
      sort: i,
    }))
  }

  return {
    dirty,
    listPlans, createPlan, updatePlan, deletePlan,
    listTasks, listAgenda, createTask, updateTask, setTaskStatus, deleteTask,
    extractPlan, resolveDrafts, offsetToDueAt,
  }
}
