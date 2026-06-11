<script setup lang="ts">
/**
 * Plans & tasks board for the Vibe "Next" tab — the whole follow-up task system
 * in one place. Two views:
 *  - List: every pending task grouped by when it's due (Overdue / Today /
 *    Tomorrow / This week / Later / No date), checkable, tap → contact.
 *  - Calendar: a month grid dotted with task days; tap a day to see its tasks.
 * Reloads on the shared plans signal so check-offs / new plans stay in sync.
 */
import type { CdTask, TaskChannel } from '~/types/directus'

const { listTasks, setTaskStatus, dirty } = usePlans()
const { contacts } = useContacts()
const { goDetail } = useNavigation()

const tasks = ref<CdTask[]>([])
const loading = ref(true)
const loadedOnce = ref(false)
const view = ref<'list' | 'calendar'>('list')
const busy = ref<Record<string, boolean>>({})

const CHANNEL_ICON: Record<TaskChannel, string> = {
  email: 'lucide:mail', linkedin: 'lucide:linkedin', call: 'lucide:phone', meet: 'lucide:coffee', other: 'lucide:circle-dot',
}
const nameById = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  for (const c of contacts.value as any[]) m[c.id] = c.name
  return m
})

// ── date helpers ──
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function startOfToday() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()) }
function diffDays(iso: string) {
  const d = new Date(iso)
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((dd.getTime() - startOfToday().getTime()) / 86_400_000)
}
function timeLabel(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
function dueChip(t: CdTask): { text: string; over: boolean; today: boolean } {
  if (!t.due_at) return { text: '', over: false, today: false }
  const n = diffDays(t.due_at)
  const time = timeLabel(t.due_at)
  if (n < 0) return { text: n === -1 ? 'Yesterday' : `${Math.abs(n)}d ago`, over: true, today: false }
  if (n === 0) return { text: time, over: false, today: true }
  if (n === 1) return { text: 'Tomorrow', over: false, today: false }
  return { text: new Date(t.due_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }), over: false, today: false }
}

// ── list grouping ──
const GROUP_ORDER = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none'] as const
const GROUP_LABEL: Record<string, string> = {
  overdue: 'Overdue', today: 'Today', tomorrow: 'Tomorrow', week: 'This week', later: 'Later', none: 'No date',
}
function bucket(t: CdTask) {
  if (!t.due_at) return 'none'
  const n = diffDays(t.due_at)
  if (n < 0) return 'overdue'
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n <= 7) return 'week'
  return 'later'
}
const groups = computed(() => {
  const m: Record<string, CdTask[]> = {}
  for (const t of tasks.value) (m[bucket(t)] ??= []).push(t)
  for (const k in m) m[k].sort((a, b) => (a.due_at ? Date.parse(a.due_at) : Infinity) - (b.due_at ? Date.parse(b.due_at) : Infinity))
  return GROUP_ORDER.filter((k) => m[k]?.length).map((k) => ({ key: k, label: GROUP_LABEL[k], items: m[k] }))
})

const total = computed(() => tasks.value.length)
const overdueCount = computed(() => tasks.value.filter((t) => t.due_at && diffDays(t.due_at) < 0).length)

// ── calendar ──
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const calRef = ref(startOfToday())
const calFirst = computed(() => new Date(calRef.value.getFullYear(), calRef.value.getMonth(), 1))
const monthLabel = computed(() => calFirst.value.toLocaleDateString([], { month: 'long', year: 'numeric' }))
const calCells = computed(() => {
  const first = calFirst.value
  const lead = first.getDay()
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d))
  return cells
})
const tasksByDay = computed(() => {
  const m: Record<string, CdTask[]> = {}
  for (const t of tasks.value) { if (t.due_at) (m[ymd(new Date(t.due_at))] ??= []).push(t) }
  return m
})
const todayKey = computed(() => ymd(startOfToday()))
const selectedDay = ref(ymd(startOfToday()))
const selectedTasks = computed(() =>
  (tasksByDay.value[selectedDay.value] ?? []).slice().sort((a, b) => (a.due_at ? Date.parse(a.due_at) : 0) - (b.due_at ? Date.parse(b.due_at) : 0)),
)
const selectedLabel = computed(() => {
  const [y, m, d] = selectedDay.value.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
})
function prevMonth() { calRef.value = new Date(calRef.value.getFullYear(), calRef.value.getMonth() - 1, 1) }
function nextMonth() { calRef.value = new Date(calRef.value.getFullYear(), calRef.value.getMonth() + 1, 1) }

// ── actions ──
async function load() {
  if (!loadedOnce.value) loading.value = true
  try { tasks.value = await listTasks({ status: 'pending', limit: 200 }) }
  catch { tasks.value = [] }
  finally { loading.value = false; loadedOnce.value = true }
}
async function complete(t: CdTask) {
  if (busy.value[t.id]) return
  busy.value = { ...busy.value, [t.id]: true }
  try { await setTaskStatus(t.id, 'done'); tasks.value = tasks.value.filter((x) => x.id !== t.id) }
  catch { /* non-fatal */ }
  finally { busy.value = { ...busy.value, [t.id]: false } }
}
function openContact(t: CdTask) { if (t.contact) goDetail(t.contact) }

onMounted(load)
watch(() => dirty.value, load)
</script>

<template>
  <div class="cd-vc tb">
    <div class="tb-hd">
      <span class="tb-title"><CdIcon emoji="🗂" icon="lucide:list-todo" :size="14" /> Plans &amp; tasks</span>
      <span v-if="overdueCount" class="tb-over">{{ overdueCount }} overdue</span>
      <div class="tb-toggle">
        <button type="button" :class="{ on: view === 'list' }" aria-label="List view" @click="view = 'list'"><CdIcon icon="lucide:list" :size="13" /></button>
        <button type="button" :class="{ on: view === 'calendar' }" aria-label="Calendar view" @click="view = 'calendar'"><CdIcon icon="lucide:calendar" :size="13" /></button>
      </div>
    </div>

    <div v-if="loading" class="tb-dim">Loading…</div>

    <div v-else-if="!total" class="tb-empty">
      <CdIcon icon="lucide:flag" :size="18" />
      <div class="tb-empty-t">No tasks yet</div>
      <div class="tb-empty-s">Turn an Earnest chat into a plan, or add tasks on a contact — they’ll show up here.</div>
    </div>

    <!-- LIST -->
    <template v-else-if="view === 'list'">
      <div v-for="g in groups" :key="g.key" class="tb-group">
        <div class="tb-group-hd" :class="g.key">{{ g.label }} <span class="tb-group-n">{{ g.items.length }}</span></div>
        <div v-for="t in g.items" :key="t.id" class="tb-task">
          <button class="tb-check" type="button" :disabled="busy[t.id]" aria-label="Mark done" @click="complete(t)" />
          <button class="tb-main" type="button" @click="openContact(t)">
            <div class="tb-task-title">{{ t.title }}</div>
            <div class="tb-meta">
              <span v-if="t.contact && nameById[t.contact]" class="tb-who">{{ nameById[t.contact] }}</span>
              <span v-if="t.channel" class="tb-chan"><CdIcon :icon="CHANNEL_ICON[t.channel]" :size="10" /></span>
              <span v-if="dueChip(t).text" class="tb-due" :class="{ over: dueChip(t).over, today: dueChip(t).today }">{{ dueChip(t).text }}</span>
            </div>
          </button>
        </div>
      </div>
    </template>

    <!-- CALENDAR -->
    <template v-else>
      <div class="tb-cal-hd">
        <button class="tb-cal-nav" type="button" aria-label="Previous month" @click="prevMonth"><CdIcon icon="lucide:chevron-left" :size="16" /></button>
        <span class="tb-cal-month">{{ monthLabel }}</span>
        <button class="tb-cal-nav" type="button" aria-label="Next month" @click="nextMonth"><CdIcon icon="lucide:chevron-right" :size="16" /></button>
      </div>
      <div class="tb-cal-grid">
        <div v-for="(d, i) in DOW" :key="'dow' + i" class="tb-dow">{{ d }}</div>
        <template v-for="(cell, i) in calCells" :key="i">
          <div v-if="!cell" class="tb-cell empty"></div>
          <button
            v-else
            type="button"
            class="tb-cell"
            :class="{ today: ymd(cell) === todayKey, sel: ymd(cell) === selectedDay, has: tasksByDay[ymd(cell)] }"
            @click="selectedDay = ymd(cell)"
          >
            <span class="tb-cell-n">{{ cell.getDate() }}</span>
            <span v-if="tasksByDay[ymd(cell)]" class="tb-cell-dot"></span>
          </button>
        </template>
      </div>

      <div class="tb-cal-day">
        <div class="tb-cal-day-hd">{{ selectedLabel }}</div>
        <div v-if="!selectedTasks.length" class="tb-dim">Nothing scheduled.</div>
        <div v-for="t in selectedTasks" :key="t.id" class="tb-task">
          <button class="tb-check" type="button" :disabled="busy[t.id]" aria-label="Mark done" @click="complete(t)" />
          <button class="tb-main" type="button" @click="openContact(t)">
            <div class="tb-task-title">{{ t.title }}</div>
            <div class="tb-meta">
              <span v-if="t.contact && nameById[t.contact]" class="tb-who">{{ nameById[t.contact] }}</span>
              <span v-if="t.channel" class="tb-chan"><CdIcon :icon="CHANNEL_ICON[t.channel]" :size="10" /></span>
              <span v-if="t.due_at" class="tb-due" :class="{ over: dueChip(t).over, today: dueChip(t).today }">{{ timeLabel(t.due_at) }}</span>
            </div>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tb { margin-bottom: 12px; }
.tb-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.tb-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: var(--cd-text); }
.tb-title :deep(svg) { color: var(--cd-accent); }
.tb-over { font-size: 9.5px; font-weight: 800; color: #e5484d; background: color-mix(in srgb, #e5484d 12%, transparent); border-radius: 5px; padding: 1px 5px; }
.tb-toggle { margin-left: auto; display: flex; gap: 2px; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 9999px; padding: 3px; }
.tb-toggle button { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 22px; border: 0; background: none; color: var(--cd-dim); border-radius: 9999px; cursor: pointer; }
.tb-toggle button.on { background: var(--cd-accent); color: #060810; }

.tb-dim { font-size: 12px; color: var(--cd-muted); padding: 4px 0; }
.tb-empty { text-align: center; padding: 14px 12px; display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--cd-muted); }
.tb-empty :deep(svg) { color: var(--cd-accent); }
.tb-empty-t { font-weight: 700; color: var(--cd-text); font-size: 13px; margin-top: 2px; }
.tb-empty-s { font-size: 12px; line-height: 1.45; max-width: 250px; }

/* groups */
.tb-group { margin-bottom: 10px; }
.tb-group:last-child { margin-bottom: 0; }
.tb-group-hd { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--cd-muted); margin-bottom: 4px; }
.tb-group-hd.overdue { color: #e5484d; }
.tb-group-hd.today { color: var(--cd-accent); }
.tb-group-n { color: var(--cd-dim); font-weight: 700; }

/* task row (shared list + calendar) */
.tb-task { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--cd-bdr); }
.tb-group .tb-task:first-of-type, .tb-cal-day .tb-task:first-of-type { border-top: 0; }
.tb-check {
  flex-shrink: 0; width: 19px; height: 19px; border-radius: 6px; cursor: pointer;
  border: 1.5px solid var(--cd-bdr); background: var(--cd-bg); transition: all 0.12s;
}
.tb-check:hover { border-color: var(--cd-accent); background: color-mix(in srgb, var(--cd-accent) 16%, transparent); }
.tb-check:disabled { opacity: 0.5; }
.tb-main { flex: 1; min-width: 0; text-align: left; background: none; border: 0; cursor: pointer; padding: 0; color: var(--cd-text); font-family: inherit; }
.tb-task-title { font-size: 13px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tb-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.tb-who { font-size: 11px; color: var(--cd-accent); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50%; }
.tb-chan { display: inline-flex; color: var(--cd-dim); }
.tb-due { font-size: 10.5px; font-weight: 700; color: var(--cd-muted); }
.tb-due.today { color: var(--cd-accent); }
.tb-due.over { color: #e5484d; }

/* calendar */
.tb-cal-hd { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.tb-cal-month { font-size: 13px; font-weight: 800; }
.tb-cal-nav { background: none; border: 0; color: var(--cd-muted); cursor: pointer; padding: 4px; }
.tb-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.tb-dow { text-align: center; font-size: 9px; font-weight: 800; color: var(--cd-dim); padding-bottom: 4px; }
.tb-cell {
  position: relative; aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  border: 1px solid transparent; border-radius: 8px; background: none; color: var(--cd-muted);
  font-family: inherit; font-size: 12px; cursor: pointer;
}
.tb-cell.empty { cursor: default; }
.tb-cell.has { color: var(--cd-text); font-weight: 700; }
.tb-cell.today { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.tb-cell.sel { background: var(--cd-accent); color: #060810; font-weight: 800; }
.tb-cell-dot { position: absolute; bottom: 4px; width: 4px; height: 4px; border-radius: 50%; background: var(--cd-accent); }
.tb-cell.sel .tb-cell-dot { background: #060810; }
.tb-cal-day { margin-top: 12px; border-top: 1px solid var(--cd-bdr); padding-top: 10px; }
.tb-cal-day-hd { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--cd-muted); margin-bottom: 4px; }
</style>
