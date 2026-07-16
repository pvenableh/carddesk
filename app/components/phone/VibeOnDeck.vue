<script setup lang="ts">
/**
 * Vibe "On deck" — a tight daily agenda: follow-up tasks that are overdue or due
 * today, across all contacts. Deliberately narrow (max 5, dated, pending only) so
 * it reinforces the daily-action loop without turning Vibe into a task manager.
 * Tap a task to jump to its contact; check it off in place. Hidden when empty.
 */
import type { CdTask, TaskChannel } from '~/types/directus'
import { dueMeta } from '~/composables/usePlans'

const { listAgenda, setTaskStatus, dirty } = usePlans()
const { contacts } = useContacts()
const { goDetail } = useNavigation()

const tasks = ref<CdTask[]>([])
const loaded = ref(false)
const busy = ref<Record<string, boolean>>({})

const CHANNEL_ICON: Record<TaskChannel, string> = {
  email: 'lucide:mail', linkedin: 'lucide:linkedin', call: 'lucide:phone', meet: 'lucide:coffee', other: 'lucide:circle-dot',
}

const nameById = computed<Record<string, string>>(() => {
  const m: Record<string, string> = {}
  for (const c of contacts.value as any[]) m[c.id] = c.name
  return m
})

const visible = computed(() => tasks.value.slice(0, 5))
const overdueCount = computed(() => tasks.value.filter((t) => dueMeta(t.due_at).overdue).length)

async function load() {
  try {
    tasks.value = await listAgenda()
  } catch {
    tasks.value = []
  } finally {
    loaded.value = true
  }
}

async function complete(t: CdTask) {
  if (busy.value[t.id]) return
  busy.value = { ...busy.value, [t.id]: true }
  try {
    await setTaskStatus(t.id, 'done')
    tasks.value = tasks.value.filter((x) => x.id !== t.id)
  } catch { /* non-fatal */ }
  finally {
    busy.value = { ...busy.value, [t.id]: false }
  }
}

function openContact(t: CdTask) {
  if (t.contact) goDetail(t.contact)
}

onMounted(load)
watch(() => dirty.value, load)
</script>

<template>
  <div v-if="loaded && tasks.length" class="cd-vc od">
    <div class="od-hd">
      <CdIcon emoji="📌" icon="lucide:list-checks" :size="13" />
      <span>On deck</span>
      <span v-if="overdueCount" class="od-over">{{ overdueCount }} overdue</span>
      <span class="od-count">{{ tasks.length }}</span>
    </div>

    <div class="od-list">
      <div v-for="t in visible" :key="t.id" class="od-task">
        <button class="od-check" type="button" :disabled="busy[t.id]" aria-label="Mark done" @click="complete(t)" />
        <button class="od-main" type="button" @click="openContact(t)">
          <div class="od-title">{{ t.title }}</div>
          <div class="od-meta">
            <span v-if="t.contact && nameById[t.contact]" class="od-who"><CdIcon icon="lucide:user" :size="10" /> {{ nameById[t.contact] }}</span>
            <span v-if="t.channel" class="od-chan"><CdIcon :icon="CHANNEL_ICON[t.channel]" :size="10" /></span>
            <span class="od-due" :class="{ over: dueMeta(t.due_at).overdue, today: dueMeta(t.due_at).today }">{{ dueMeta(t.due_at).label }}</span>
          </div>
        </button>
      </div>
    </div>

    <div v-if="tasks.length > visible.length" class="od-more">+{{ tasks.length - visible.length }} more due</div>
  </div>
</template>

<style scoped>
.od { border-color: color-mix(in srgb, var(--cd-accent) 22%, var(--cd-bdr)); }
.od-hd {
  display: flex; align-items: center; gap: 7px; margin-bottom: 10px;
  font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: var(--cd-text);
}
.od-hd :deep(svg) { color: var(--cd-accent); }
.od-over {
  font-size: 9.5px; font-weight: 800; color: #e5484d; letter-spacing: 0.03em;
  background: color-mix(in srgb, #e5484d 12%, transparent); border-radius: 5px; padding: 1px 5px;
}
.od-count { margin-left: auto; font-size: 11px; color: var(--cd-dim); font-variant-numeric: tabular-nums; }

.od-list { display: flex; flex-direction: column; gap: 2px; }
.od-task { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid var(--cd-bdr); }
.od-task:first-child { border-top: 0; }
.od-check {
  flex-shrink: 0; width: 19px; height: 19px; border-radius: 6px; cursor: pointer;
  border: 1.5px solid var(--cd-bdr); background: var(--cd-bg); transition: background 0.15s var(--spring-bounce), border-color 0.15s var(--cd-ease), transform 0.15s var(--spring-bounce);
}
.od-check:hover { border-color: var(--cd-accent); background: color-mix(in srgb, var(--cd-accent) 16%, transparent); }
.od-check:disabled { opacity: 0.5; }
.od-main { flex: 1; min-width: 0; text-align: left; background: none; border: 0; cursor: pointer; padding: 0; color: var(--cd-text); font-family: inherit; }
.od-title { font-size: 13px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.od-meta { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.od-who {
  display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
  font-size: 10.5px; color: var(--cd-accent); font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 26%, transparent);
  border-radius: 999px; padding: 1px 8px 1px 6px;
}
.od-who :deep(svg) { flex-shrink: 0; }
.od-chan { display: inline-flex; color: var(--cd-dim); }
.od-due { font-size: 10.5px; font-weight: 700; color: var(--cd-muted); }
.od-due.today { color: var(--cd-accent); }
.od-due.over { color: #e5484d; }
.od-more { margin-top: 8px; font-size: 11px; color: var(--cd-dim); text-align: center; }
</style>
