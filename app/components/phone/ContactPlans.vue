<script setup lang="ts">
/**
 * Contact "Plan of attack" widget. Shows this contact's active plan(s) with
 * their tasks — checkable inline — plus any standalone tasks, and lets the user
 * add a one-off task by hand or reveal finished/archived plans. Reloads whenever
 * the shared plans signal bumps (e.g. a plan was just saved from the chat sheet).
 * Emits `ask` so the empty state can open the coach.
 */
import type { CdPlan, CdTask, TaskChannel } from '~/types/directus'
import { dueMeta } from '~/composables/usePlans'

const props = defineProps<{ contactId: string }>()
const emit = defineEmits<{ (e: 'ask'): void }>()

const { listPlans, listTasks, createTask, setTaskStatus, deleteTask, deletePlan, dirty } = usePlans()

const plans = ref<CdPlan[]>([])
const looseTasks = ref<CdTask[]>([])
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

const activePlans = computed(() => plans.value.filter((p) => p.status === 'active'))
const donePlans = computed(() => plans.value.filter((p) => p.status !== 'active'))
const hasAnything = computed(() => plans.value.length > 0 || looseTasks.value.length > 0)

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
const sortedLoose = computed(() => [...looseTasks.value].sort(bySchedule))

function planProgress(p: CdPlan): { done: number; total: number } {
  const tasks = p.tasks ?? []
  return { done: tasks.filter((t) => t.status === 'done').length, total: tasks.length }
}

async function load() {
  // Only show the skeleton on first paint — silent refreshes (after a toggle or
  // a save elsewhere) shouldn't flash "Loading…" over the whole widget.
  if (!loadedOnce.value) loading.value = true
  try {
    const [p, t] = await Promise.all([
      listPlans({ contact: props.contactId }),
      listTasks({ contact: props.contactId }),
    ])
    plans.value = p
    looseTasks.value = (t as CdTask[]).filter((x) => !x.plan)
  } catch {
    plans.value = []
    looseTasks.value = []
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
  } catch { /* leave as-is */ }
  finally {
    busy.value = { ...busy.value, [t.id]: false }
  }
}

async function removeTask(t: CdTask) {
  try {
    await deleteTask(t.id)
    looseTasks.value = looseTasks.value.filter((x) => x.id !== t.id)
  } catch { /* non-fatal */ }
}

async function removePlan(p: CdPlan) {
  if (!confirm(`Delete the plan "${p.title}" and its tasks?`)) return
  try {
    await deletePlan(p.id)
    plans.value = plans.value.filter((x) => x.id !== p.id)
  } catch { /* non-fatal */ }
}

// ── Manual one-off task ──────────────────────────────────────────────────
const adding = ref(false)
const saving = ref(false)
const form = reactive({ title: '', due: defaultDue(), channel: null as TaskChannel | null, note: '' })

function openAdd() {
  form.title = ''
  form.due = defaultDue()
  form.channel = null
  form.note = ''
  adding.value = true
}
function cancelAdd() {
  adding.value = false
}
async function saveTask() {
  if (!form.title.trim() || saving.value) return
  saving.value = true
  try {
    const task = await createTask({
      contact: props.contactId,
      plan: null,
      title: form.title.trim(),
      channel: form.channel,
      note: form.note.trim() || null,
      due_at: fromLocalInput(form.due),
    })
    looseTasks.value = [...looseTasks.value, task]
    adding.value = false
  } catch { /* toast handled globally */ }
  finally {
    saving.value = false
  }
}

onMounted(load)
watch(() => dirty.value, load)
// New contact → reset so its own skeleton shows instead of the previous card's tasks.
watch(() => props.contactId, () => { loadedOnce.value = false; load() })
</script>

<template>
  <div class="cd-log-sec cp">
    <div class="cp-hd">
      <span>Plan of attack</span>
      <button v-if="hasAnything" class="cd-pill cp-add-btn" type="button" @click="adding ? cancelAdd() : openAdd()">
        <CdIcon :icon="adding ? 'lucide:x' : 'lucide:plus'" :size="13" /> {{ adding ? 'Cancel' : 'Task' }}
      </button>
    </div>

    <div v-if="loading" class="cp-dim">Loading…</div>

    <template v-else>
      <!-- Inline add form -->
      <div v-if="adding" class="cp-form">
        <input v-model="form.title" class="cd-inp" type="text" placeholder="What to do…" @keydown.enter="saveTask" />
        <input v-model="form.due" class="cd-inp cp-due-in" type="datetime-local" />
        <div class="cp-chips">
          <button
            v-for="c in CHANNELS"
            :key="c.value"
            type="button"
            class="cd-pill"
            :class="{ on: form.channel === c.value }"
            @click="form.channel = form.channel === c.value ? null : c.value"
          ><CdIcon :icon="c.icon" :size="11" /> {{ c.label }}</button>
        </div>
        <input v-model="form.note" class="cd-inp cp-note-in" type="text" placeholder="Note — what to reference (optional)" />
        <div class="cp-form-foot">
          <button class="cd-abtn cp-ghost" type="button" @click="cancelAdd">Cancel</button>
          <button class="cd-abtn g" type="button" :disabled="!form.title.trim() || saving" @click="saveTask">
            <CdIcon v-if="saving" icon="lucide:loader-2" :size="14" class="cp-spin" /><span v-else>Add task</span>
          </button>
        </div>
      </div>

      <!-- Empty state (no plans, no loose tasks, not currently adding) -->
      <div v-if="!hasAnything && !adding" class="cp-empty">
        <CdIcon icon="lucide:flag" :size="18" />
        <div class="cp-empty-t">No plan yet</div>
        <div class="cp-empty-s">Ask Earnest for next steps with timing and tap <strong>Make a plan</strong> — or add a task yourself.</div>
        <div class="cp-empty-actions">
          <button class="cd-abtn g cp-ask" type="button" @click="emit('ask')"><CdEarnestMark :size="14" /> Ask Earnest</button>
          <button class="cd-abtn cp-ghost cp-ask" type="button" @click="openAdd"><CdIcon icon="lucide:plus" :size="13" /> Add task</button>
        </div>
      </div>

      <template v-else>
        <!-- Standalone tasks -->
        <div v-if="sortedLoose.length" class="cp-plan">
          <div class="cp-plan-hd"><div class="cp-plan-title cp-loose-title">Tasks</div></div>
          <div v-for="t in sortedLoose" :key="t.id" class="cp-task" :class="{ done: t.status === 'done' }">
            <button class="cp-check" :class="{ on: t.status === 'done' }" type="button" :disabled="busy[t.id]" @click="toggle(t)">
              <CdIcon v-if="t.status === 'done'" icon="lucide:check" :size="12" />
            </button>
            <div class="cp-task-main">
              <div class="cp-task-title">{{ t.title }}</div>
              <div class="cp-task-meta">
                <span v-if="t.channel" class="cp-chan"><CdIcon :icon="CHANNEL_ICON[t.channel]" :size="11" /> {{ t.channel }}</span>
                <span v-if="t.due_at && t.status !== 'done'" class="cp-due" :class="{ over: dueMeta(t.due_at).overdue, today: dueMeta(t.due_at).today }">{{ dueMeta(t.due_at).label }}</span>
              </div>
              <div v-if="t.note && t.status !== 'done'" class="cp-note">{{ t.note }}</div>
            </div>
            <button class="cp-del" type="button" aria-label="Delete task" @click="removeTask(t)"><CdIcon icon="lucide:trash-2" :size="12" /></button>
          </div>
        </div>

        <!-- Active plans -->
        <div v-for="p in activePlans" :key="p.id" class="cp-plan">
          <div class="cp-plan-hd">
            <div class="cp-plan-title">{{ p.title }}</div>
            <div class="cp-plan-right">
              <span class="cp-prog">{{ planProgress(p).done }}/{{ planProgress(p).total }}</span>
              <button class="cp-del" type="button" aria-label="Delete plan" @click="removePlan(p)"><CdIcon icon="lucide:trash-2" :size="13" /></button>
            </div>
          </div>
          <div v-for="t in sortedTasks(p)" :key="t.id" class="cp-task" :class="{ done: t.status === 'done' }">
            <button class="cp-check" :class="{ on: t.status === 'done' }" type="button" :disabled="busy[t.id]" @click="toggle(t)">
              <CdIcon v-if="t.status === 'done'" icon="lucide:check" :size="12" />
            </button>
            <div class="cp-task-main">
              <div class="cp-task-title">{{ t.title }}</div>
              <div class="cp-task-meta">
                <span v-if="t.channel" class="cp-chan"><CdIcon :icon="CHANNEL_ICON[t.channel]" :size="11" /> {{ t.channel }}</span>
                <span v-if="t.due_at && t.status !== 'done'" class="cp-due" :class="{ over: dueMeta(t.due_at).overdue, today: dueMeta(t.due_at).today }">{{ dueMeta(t.due_at).label }}</span>
              </div>
              <div v-if="t.note && t.status !== 'done'" class="cp-note">{{ t.note }}</div>
            </div>
          </div>
        </div>

        <!-- Finished / archived -->
        <button v-if="donePlans.length" class="cp-toggle" type="button" @click="showDone = !showDone">
          <CdIcon :icon="showDone ? 'lucide:chevron-down' : 'lucide:chevron-right'" :size="13" />
          {{ showDone ? 'Hide' : 'Show' }} {{ donePlans.length }} past plan{{ donePlans.length === 1 ? '' : 's' }}
        </button>
        <div v-if="showDone" class="cp-past">
          <div v-for="p in donePlans" :key="p.id" class="cp-past-row">
            <div class="cp-past-title">{{ p.title }}</div>
            <span class="cp-past-meta">{{ planProgress(p).done }}/{{ planProgress(p).total }} · {{ p.status }}</span>
            <button class="cp-del" type="button" aria-label="Delete plan" @click="removePlan(p)"><CdIcon icon="lucide:trash-2" :size="12" /></button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.cp { margin-bottom: 16px; }
.cp-hd {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-dim); margin-bottom: 10px;
}
.cp-add-btn { font-size: 11px; }
.cp-dim { font-size: 12px; color: var(--cd-muted); }

/* add form — inputs/chips/buttons use the app's canonical cd-inp / cd-pill / cd-abtn */
.cp-form { background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 16px; padding: 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }
.cp-form .cd-inp { margin-bottom: 0; }
.cp-due-in { color-scheme: dark; }
.cp-note-in { font-size: 12px; }
.cp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cp-form-foot { display: flex; gap: 8px; }
.cp-form-foot .cd-abtn { flex: 1; }
.cp-ghost { background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); }
.cp-spin { animation: cp-spin 0.8s linear infinite; }
@keyframes cp-spin { to { transform: rotate(360deg); } }

.cp-empty {
  text-align: center; padding: 16px 12px; border: 1px dashed var(--cd-bdr); border-radius: 14px;
  color: var(--cd-muted); display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.cp-empty :deep(svg) { color: var(--cd-accent); }
.cp-empty-t { font-weight: 700; color: var(--cd-text); font-size: 13px; margin-top: 2px; }
.cp-empty-s { font-size: 12px; line-height: 1.45; max-width: 250px; }
.cp-empty-actions { display: flex; gap: 8px; margin-top: 10px; align-self: stretch; }
.cp-ask { flex: 1; }

.cp-plan { background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px; padding: 11px 12px; margin-bottom: 10px; }
.cp-plan-hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.cp-plan-title { font-size: 13px; font-weight: 800; }
.cp-loose-title { color: var(--cd-dim); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
.cp-plan-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.cp-prog { font-size: 11px; color: var(--cd-dim); font-variant-numeric: tabular-nums; }
.cp-del { background: none; border: 0; color: var(--cd-dim); cursor: pointer; padding: 2px; flex-shrink: 0; }
.cp-del:hover { color: #e5484d; }

.cp-task { display: flex; gap: 9px; padding: 7px 0; border-top: 1px solid var(--cd-bdr); align-items: flex-start; }
.cp-task:first-of-type { border-top: 0; }
.cp-check {
  flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; border-radius: 6px; cursor: pointer;
  border: 1.5px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-bg);
  display: flex; align-items: center; justify-content: center; transition: all 0.12s;
}
.cp-check.on { background: var(--cd-accent); border-color: var(--cd-accent); }
.cp-check:disabled { opacity: 0.5; }
.cp-task-main { flex: 1; min-width: 0; }
.cp-task-title { font-size: 13px; line-height: 1.35; }
.cp-task.done .cp-task-title { text-decoration: line-through; color: var(--cd-dim); }
.cp-task-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 3px; }
.cp-chan { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; color: var(--cd-muted); text-transform: capitalize; }
.cp-due {
  font-size: 10.5px; font-weight: 700; color: var(--cd-muted);
  background: var(--cd-bg); border: 1px solid var(--cd-bdr); border-radius: 6px; padding: 1px 6px;
}
.cp-due.today { color: var(--cd-accent); border-color: color-mix(in srgb, var(--cd-accent) 34%, transparent); }
.cp-due.over { color: #e5484d; border-color: color-mix(in srgb, #e5484d 34%, transparent); }
.cp-note { font-size: 11.5px; color: var(--cd-muted); line-height: 1.4; margin-top: 3px; }

.cp-toggle {
  display: inline-flex; align-items: center; gap: 4px; background: none; border: 0; cursor: pointer;
  color: var(--cd-muted); font-family: inherit; font-size: 11.5px; padding: 4px 0;
}
.cp-past { margin-top: 4px; }
.cp-past-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--cd-bdr); }
.cp-past-title { flex: 1; font-size: 12px; color: var(--cd-muted); }
.cp-past-meta { font-size: 10.5px; color: var(--cd-dim); text-transform: capitalize; }
</style>
