<script setup lang="ts">
/**
 * Plans board — the global plan manager behind the Vibe "Next" › Plans toggle.
 * Lists every plan across all contacts (plus contact-less "general" plans),
 * split into Active and Completed. Each plan shows a progress bar, its tasks
 * (checkable inline), a contact chip, and rename/delete. Users can spin up a new
 * general plan here without a contact. Reloads on the shared plans signal so
 * check-offs from any surface stay in sync.
 */
import type { CdPlan, CdTask, TaskChannel } from '~/types/directus'
import { dueMeta } from '~/composables/usePlans'

const { listPlans, createPlan, updatePlan, deletePlan, createTask, setTaskStatus, deleteTask, dirty } = usePlans()
const { contacts } = useContacts()
const { goDetail } = useNavigation()

const plans = ref<CdPlan[]>([])
const loading = ref(true)
const loadedOnce = ref(false)
const showDone = ref(false)
const busy = ref<Record<string, boolean>>({})

const CHANNELS: { value: TaskChannel; label: string; icon: string }[] = [
  { value: 'email', label: 'Email', icon: 'lucide:mail' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'lucide:linkedin' },
  { value: 'call', label: 'Call', icon: 'lucide:phone' },
  { value: 'meet', label: 'Meet', icon: 'lucide:coffee' },
  { value: 'other', label: 'Other', icon: 'lucide:circle-dot' },
]
const CHANNEL_ICON = Object.fromEntries(CHANNELS.map((c) => [c.value, c.icon])) as Record<TaskChannel, string>

const nameById = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  for (const c of contacts.value as any[]) m[c.id] = c.name
  return m
})

const activePlans = computed(() => plans.value.filter((p) => p.status === 'active'))
const donePlans = computed(() => plans.value.filter((p) => p.status !== 'active'))

// datetime-local <-> ISO (input speaks local wall-clock; we store ISO).
function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
function defaultDue(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return toLocalInput(d.toISOString())
}

function bySchedule(a: CdTask, b: CdTask): number {
  const ad = a.status === 'done' ? 1 : 0
  const bd = b.status === 'done' ? 1 : 0
  if (ad !== bd) return ad - bd
  const at = a.due_at ? Date.parse(a.due_at) : Infinity
  const bt = b.due_at ? Date.parse(b.due_at) : Infinity
  if (at !== bt) return at - bt
  return (a.sort ?? 0) - (b.sort ?? 0)
}
function sortedTasks(p: CdPlan): CdTask[] {
  return [...(p.tasks ?? [])].sort(bySchedule)
}
function planProgress(p: CdPlan): { done: number; total: number; pct: number } {
  const tasks = p.tasks ?? []
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'done').length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}
function planDoneOn(p: CdPlan): string {
  const stamps = (p.tasks ?? []).map((t) => t.completed_at).filter(Boolean).map((s) => Date.parse(s as string))
  if (!stamps.length) return ''
  return new Date(Math.max(...stamps)).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

async function load() {
  if (!loadedOnce.value) loading.value = true
  try {
    plans.value = await listPlans()
  } catch {
    plans.value = []
  } finally {
    loading.value = false
    loadedOnce.value = true
  }
}

async function toggle(t: CdTask) {
  if (busy.value[t.id]) return
  busy.value = { ...busy.value, [t.id]: true }
  const next = t.status === 'done' ? 'pending' : 'done'
  try {
    await setTaskStatus(t.id, next)
    t.status = next
    t.completed_at = next === 'done' ? new Date().toISOString() : null
    // setTaskStatus bumps the shared signal; load() below reconciles plan status.
  } catch { /* leave as-is */ }
  finally {
    busy.value = { ...busy.value, [t.id]: false }
  }
}

async function removeTask(p: CdPlan, t: CdTask) {
  try {
    await deleteTask(t.id)
    p.tasks = (p.tasks ?? []).filter((x) => x.id !== t.id)
  } catch { /* non-fatal */ }
}
async function removePlan(p: CdPlan) {
  if (!confirm(`Delete the plan "${p.title}" and its tasks?`)) return
  try {
    await deletePlan(p.id)
    plans.value = plans.value.filter((x) => x.id !== p.id)
  } catch { /* non-fatal */ }
}
async function archivePlan(p: CdPlan) {
  try { await updatePlan(p.id, { status: 'archived' }); p.status = 'archived' } catch { /* non-fatal */ }
}

// ── New (general) plan ─────────────────────────────────────────────────────
const creating = ref(false)
const newTitle = ref('')
const savingPlan = ref(false)
function openCreate() { creating.value = true; newTitle.value = '' }
async function createNewPlan() {
  const title = newTitle.value.trim()
  if (!title || savingPlan.value) return
  savingPlan.value = true
  try {
    const plan = await createPlan({ title, contact: null })
    plans.value = [{ ...plan, tasks: [] }, ...plans.value]
    creating.value = false
  } catch { /* toast handled globally */ }
  finally { savingPlan.value = false }
}

// ── Inline rename ──────────────────────────────────────────────────────────
const renamingId = ref<string | null>(null)
const renameText = ref('')
function startRename(p: CdPlan) { renamingId.value = p.id; renameText.value = p.title }
async function commitRename(p: CdPlan) {
  const title = renameText.value.trim()
  renamingId.value = null
  if (!title || title === p.title) return
  p.title = title
  try { await updatePlan(p.id, { title }) } catch { /* non-fatal */ }
}

// ── Add task to a plan ─────────────────────────────────────────────────────
const addingPlanId = ref<string | null>(null)
const savingTask = ref(false)
const taskForm = reactive({ title: '', due: defaultDue(), channel: null as TaskChannel | null, note: '' })
function openAddTask(p: CdPlan) {
  addingPlanId.value = p.id
  taskForm.title = ''
  taskForm.due = defaultDue()
  taskForm.channel = null
  taskForm.note = ''
}
async function saveTask(p: CdPlan) {
  if (!taskForm.title.trim() || savingTask.value) return
  savingTask.value = true
  try {
    const task = await createTask({
      plan: p.id,
      contact: p.contact ?? null,
      title: taskForm.title.trim(),
      channel: taskForm.channel,
      note: taskForm.note.trim() || null,
      due_at: fromLocalInput(taskForm.due),
    })
    p.tasks = [...(p.tasks ?? []), task]
    addingPlanId.value = null
  } catch { /* toast handled globally */ }
  finally { savingTask.value = false }
}

function openContact(p: CdPlan) {
  if (p.contact) goDetail(p.contact)
}

onMounted(load)
watch(() => dirty.value, load)
</script>

<template>
  <div class="pb">
    <!-- New plan -->
    <div class="pb-new">
      <div v-if="!creating" class="pb-new-row">
        <button class="cd-abtn g pb-new-btn" type="button" @click="openCreate">
          <CdIcon icon="lucide:plus" :size="14" /> New plan
        </button>
      </div>
      <div v-else class="pb-new-form">
        <input
          v-model="newTitle"
          class="cd-inp"
          type="text"
          placeholder="Plan name — e.g. Q3 outreach push"
          @keydown.enter="createNewPlan"
          @keydown.esc="creating = false"
        />
        <div class="pb-new-foot">
          <button class="cd-abtn pb-ghost" type="button" @click="creating = false">Cancel</button>
          <button class="cd-abtn g" type="button" :disabled="!newTitle.trim() || savingPlan" @click="createNewPlan">Create</button>
        </div>
        <div class="pb-new-hint">No contact needed — a general plan. Tasks inside it can still point at people.</div>
      </div>
    </div>

    <div v-if="loading" class="pb-dim">Loading plans…</div>

    <template v-else>
      <div v-if="!plans.length" class="pb-empty">
        <CdIcon icon="lucide:flag" :size="20" />
        <div class="pb-empty-t">No plans yet</div>
        <div class="pb-empty-s">Make a plan on a contact with Earnest, or start a general one above.</div>
      </div>

      <!-- Active plans -->
      <div v-for="p in activePlans" :key="p.id" class="pb-plan">
        <div class="pb-plan-hd">
          <input
            v-if="renamingId === p.id"
            v-model="renameText"
            class="cd-inp pb-rename"
            type="text"
            @blur="commitRename(p)"
            @keydown.enter="commitRename(p)"
            @keydown.esc="renamingId = null"
          />
          <button v-else class="pb-plan-title" type="button" title="Tap to rename" @click="startRename(p)">{{ p.title }}</button>
          <span class="pb-prog">{{ planProgress(p).done }}/{{ planProgress(p).total }}</span>
        </div>
        <div class="pb-meta-row">
          <button v-if="p.contact && nameById[p.contact]" class="pb-chip who" type="button" @click="openContact(p)">
            <CdIcon icon="lucide:user" :size="10" /> {{ nameById[p.contact] }}
          </button>
          <span v-else class="pb-chip gen"><CdIcon icon="lucide:globe" :size="10" /> General</span>
          <div class="pb-actions">
            <button class="pb-ico" type="button" aria-label="Archive plan" title="Archive" @click="archivePlan(p)"><CdIcon icon="lucide:archive" :size="13" /></button>
            <button class="pb-ico" type="button" aria-label="Delete plan" title="Delete" @click="removePlan(p)"><CdIcon icon="lucide:trash-2" :size="13" /></button>
          </div>
        </div>
        <div class="pb-bar"><span class="pb-bar-fill" :style="{ width: planProgress(p).pct + '%' }"></span></div>

        <div v-for="t in sortedTasks(p)" :key="t.id" class="pb-task" :class="{ done: t.status === 'done' }">
          <button class="pb-check" :class="{ on: t.status === 'done' }" type="button" :disabled="busy[t.id]" @click="toggle(t)">
            <CdIcon v-if="t.status === 'done'" icon="lucide:check" :size="12" />
          </button>
          <div class="pb-task-main">
            <div class="pb-task-title">{{ t.title }}</div>
            <div class="pb-task-meta">
              <span v-if="t.contact && nameById[t.contact] && t.contact !== p.contact" class="pb-who-mini">{{ nameById[t.contact] }}</span>
              <span v-if="t.channel" class="pb-chan"><CdIcon :icon="CHANNEL_ICON[t.channel]" :size="11" /> {{ t.channel }}</span>
              <span v-if="t.due_at && t.status !== 'done'" class="pb-due" :class="{ over: dueMeta(t.due_at).overdue, today: dueMeta(t.due_at).today }">{{ dueMeta(t.due_at).label }}</span>
            </div>
            <div v-if="t.note && t.status !== 'done'" class="pb-note">{{ t.note }}</div>
          </div>
          <button class="pb-ico" type="button" aria-label="Delete task" @click="removeTask(p, t)"><CdIcon icon="lucide:trash-2" :size="12" /></button>
        </div>

        <!-- Inline add task -->
        <div v-if="addingPlanId === p.id" class="pb-task-form">
          <input v-model="taskForm.title" class="cd-inp" type="text" placeholder="What to do…" @keydown.enter="saveTask(p)" />
          <input v-model="taskForm.due" class="cd-inp pb-due-in" type="datetime-local" />
          <div class="pb-chips">
            <button
              v-for="c in CHANNELS"
              :key="c.value"
              type="button"
              class="cd-pill"
              :class="{ on: taskForm.channel === c.value }"
              @click="taskForm.channel = taskForm.channel === c.value ? null : c.value"
            ><CdIcon :icon="c.icon" :size="11" /> {{ c.label }}</button>
          </div>
          <input v-model="taskForm.note" class="cd-inp pb-note-in" type="text" placeholder="Note (optional)" />
          <div class="pb-task-form-foot">
            <button class="cd-abtn pb-ghost" type="button" @click="addingPlanId = null">Cancel</button>
            <button class="cd-abtn g" type="button" :disabled="!taskForm.title.trim() || savingTask" @click="saveTask(p)">Add task</button>
          </div>
        </div>
        <button v-else class="pb-addtask" type="button" @click="openAddTask(p)"><CdIcon icon="lucide:plus" :size="12" /> Add task</button>
      </div>

      <!-- Completed / archived -->
      <button v-if="donePlans.length" class="pb-toggle" type="button" @click="showDone = !showDone">
        <CdIcon :icon="showDone ? 'lucide:chevron-down' : 'lucide:chevron-right'" :size="14" />
        {{ showDone ? 'Hide' : 'Show' }} {{ donePlans.length }} completed plan{{ donePlans.length === 1 ? '' : 's' }}
      </button>
      <template v-if="showDone">
        <div v-for="p in donePlans" :key="p.id" class="pb-plan past">
          <div class="pb-plan-hd">
            <span v-if="p.status === 'done'" class="pb-done-badge"><CdIcon icon="lucide:check" :size="10" /> Done</span>
            <span v-else class="pb-arch-badge">Archived</span>
            <div class="pb-plan-title past-title">{{ p.title }}</div>
            <span class="pb-prog">{{ planProgress(p).done }}/{{ planProgress(p).total }}</span>
          </div>
          <div class="pb-meta-row">
            <button v-if="p.contact && nameById[p.contact]" class="pb-chip who" type="button" @click="openContact(p)">
              <CdIcon icon="lucide:user" :size="10" /> {{ nameById[p.contact] }}
            </button>
            <span v-else class="pb-chip gen"><CdIcon icon="lucide:globe" :size="10" /> General</span>
            <span v-if="p.status === 'done' && planDoneOn(p)" class="pb-done-on">Completed {{ planDoneOn(p) }}</span>
            <div class="pb-actions">
              <button class="pb-ico" type="button" aria-label="Delete plan" @click="removePlan(p)"><CdIcon icon="lucide:trash-2" :size="13" /></button>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.pb { display: flex; flex-direction: column; }
.pb-dim { font-size: 12px; color: var(--cd-muted); padding: 8px 2px; }

.pb-new { margin-bottom: 12px; }
.pb-new-btn { width: 100%; }
.pb-new-form { background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.pb-new-form .cd-inp { margin-bottom: 0; }
.pb-new-foot { display: flex; gap: 8px; }
.pb-new-foot .cd-abtn { flex: 1; }
.pb-new-hint { font-size: 11px; color: var(--cd-dim); line-height: 1.4; }
.pb-ghost { background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); }

.pb-empty { text-align: center; padding: 22px 14px; border: 1px dashed var(--cd-bdr); border-radius: 14px; color: var(--cd-muted); display: flex; flex-direction: column; align-items: center; gap: 4px; }
.pb-empty :deep(svg) { color: var(--cd-accent); }
.pb-empty-t { font-weight: 700; color: var(--cd-text); font-size: 14px; margin-top: 4px; }
.pb-empty-s { font-size: 12px; line-height: 1.45; max-width: 260px; }

.pb-plan { background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px; padding: 11px 12px; margin-bottom: 10px; }
.pb-plan.past { opacity: 0.92; }
.pb-plan-hd { display: flex; align-items: center; gap: 8px; }
.pb-plan-title { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 800; background: none; border: 0; padding: 0; margin: 0; color: inherit; font-family: inherit; text-align: left; cursor: text; }
.past-title { cursor: default; }
.pb-rename { flex: 1; margin: 0 !important; padding: 4px 8px; font-size: 13.5px; font-weight: 800; }
.pb-prog { font-size: 11px; color: var(--cd-dim); font-variant-numeric: tabular-nums; flex-shrink: 0; }

.pb-meta-row { display: flex; align-items: center; gap: 8px; margin: 7px 0; }
.pb-chip {
  display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700;
  border-radius: 999px; padding: 2px 9px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); cursor: default; font-family: inherit;
}
.pb-chip.who { color: var(--cd-accent); border-color: color-mix(in srgb, var(--cd-accent) 30%, transparent); cursor: pointer; }
.pb-chip.gen { color: var(--cd-muted); }
.pb-actions { margin-left: auto; display: flex; gap: 4px; flex-shrink: 0; }
.pb-ico { background: none; border: 0; color: var(--cd-dim); cursor: pointer; padding: 2px; }
.pb-ico:hover { color: #e5484d; }
.pb-done-on { font-size: 10.5px; color: var(--cd-dim); margin-left: 2px; }

.pb-bar { height: 4px; border-radius: 999px; background: var(--cd-bdr); overflow: hidden; margin-bottom: 8px; }
.pb-bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--cd-accent); transition: width 0.25s ease; }

.pb-task { display: flex; gap: 9px; padding: 7px 0; border-top: 1px solid var(--cd-bdr); align-items: flex-start; }
.pb-check {
  flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; cursor: pointer;
  border: 1.5px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-bg);
  display: flex; align-items: center; justify-content: center; transition: all 0.12s;
}
.pb-check.on { background: var(--cd-accent); border-color: var(--cd-accent); }
.pb-check:disabled { opacity: 0.5; }
.pb-task-main { flex: 1; min-width: 0; }
.pb-task-title { font-size: 13px; line-height: 1.35; }
.pb-task.done .pb-task-title { text-decoration: line-through; color: var(--cd-dim); }
.pb-task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 3px; }
.pb-who-mini { font-size: 10.5px; font-weight: 700; color: var(--cd-accent); }
.pb-chan { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--cd-muted); text-transform: capitalize; }
.pb-due { font-size: 10.5px; font-weight: 700; color: var(--cd-muted); background: var(--cd-bg); border: 1px solid var(--cd-bdr); border-radius: 6px; padding: 1px 6px; }
.pb-due.today { color: var(--cd-accent); border-color: color-mix(in srgb, var(--cd-accent) 34%, transparent); }
.pb-due.over { color: #e5484d; border-color: color-mix(in srgb, #e5484d 34%, transparent); }
.pb-note { font-size: 11.5px; color: var(--cd-muted); line-height: 1.4; margin-top: 3px; }

.pb-addtask { display: inline-flex; align-items: center; gap: 4px; background: none; border: 0; cursor: pointer; color: var(--cd-muted); font-family: inherit; font-size: 11.5px; padding: 8px 0 2px; }
.pb-addtask:hover { color: var(--cd-accent); }
.pb-task-form { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--cd-bdr); display: flex; flex-direction: column; gap: 8px; }
.pb-task-form .cd-inp { margin-bottom: 0; }
.pb-due-in { color-scheme: dark; }
.pb-note-in { font-size: 12px; }
.pb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pb-task-form-foot { display: flex; gap: 8px; }
.pb-task-form-foot .cd-abtn { flex: 1; }

.pb-toggle { display: inline-flex; align-items: center; gap: 4px; background: none; border: 0; cursor: pointer; color: var(--cd-muted); font-family: inherit; font-size: 12px; padding: 6px 0 10px; }
.pb-done-badge { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cd-accent); background: color-mix(in srgb, var(--cd-accent) 14%, transparent); border-radius: 5px; padding: 1px 5px; }
.pb-arch-badge { display: inline-flex; align-items: center; flex-shrink: 0; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--cd-dim); background: var(--cd-bg); border: 1px solid var(--cd-bdr); border-radius: 5px; padding: 1px 5px; }
</style>
