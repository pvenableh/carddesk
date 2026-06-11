<script setup lang="ts">
/**
 * Plan review sheet — the human-in-the-loop step between "Earnest extracted a
 * plan" and "save it". Slides up over the chat. The AI proposes tasks with
 * concrete due dates (resolved from its day-offsets); the user edits titles,
 * dates, channels, drops steps, then saves. Nothing is written until they
 * confirm, so the AI never silently schedules anything.
 */
import type { DraftTask } from '~/composables/usePlans'
import type { TaskChannel } from '~/types/directus'

const props = defineProps<{
  open: boolean
  title: string
  drafts: DraftTask[]
  contactId?: string | null
  sourceSession?: string | null
}>()

const emit = defineEmits<{ (e: 'close'): void; (e: 'saved', plan: any): void }>()

const { createPlan } = usePlans()
const { success, error: showError } = useToast()

const planTitle = ref('')
const rows = ref<DraftTask[]>([])
const saving = ref(false)

const CHANNELS: { value: TaskChannel; label: string; icon: string }[] = [
  { value: 'email', label: 'Email', icon: 'lucide:mail' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'lucide:linkedin' },
  { value: 'call', label: 'Call', icon: 'lucide:phone' },
  { value: 'meet', label: 'Meet', icon: 'lucide:coffee' },
  { value: 'other', label: 'Other', icon: 'lucide:circle-dot' },
]

// datetime-local <-> ISO. The input speaks local wall-clock; we store ISO.
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

// Re-seed editable state each time the sheet opens.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      planTitle.value = props.title || 'Plan of attack'
      rows.value = props.drafts.map((d) => ({ ...d, _due: toLocalInput(d.due_at) }) as any)
    }
  },
  { immediate: true },
)

function addRow() {
  const last = rows.value[rows.value.length - 1] as any
  const base = last?._due ? new Date(fromLocalInput(last._due) as string) : new Date()
  base.setDate(base.getDate() + 2)
  base.setHours(9, 0, 0, 0)
  rows.value.push({ title: '', channel: null, note: null, due_at: base.toISOString(), _due: toLocalInput(base.toISOString()) } as any)
}
function removeRow(i: number) {
  rows.value.splice(i, 1)
}

const canSave = computed(() => planTitle.value.trim() && rows.value.some((r) => r.title.trim()))

async function save() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    const tasks: DraftTask[] = rows.value
      .filter((r) => r.title.trim())
      .map((r: any, i) => ({
        title: r.title.trim(),
        channel: r.channel ?? null,
        note: r.note?.trim() || null,
        due_at: fromLocalInput(r._due),
        sort: i,
      }))
    const plan = await createPlan({
      title: planTitle.value.trim(),
      contact: props.contactId ?? null,
      source_session: props.sourceSession ?? null,
      tasks,
    })
    success(`Plan saved — ${tasks.length} task${tasks.length === 1 ? '' : 's'} added`)
    emit('saved', plan)
    emit('close')
  } catch (err: any) {
    showError(err?.data?.message || 'Couldn’t save the plan — try again.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <transition name="cd-sheet">
    <div v-if="open" class="pr-overlay" @click.self="emit('close')">
      <div class="pr-sheet">
        <div class="pr-grab" />
        <div class="pr-hd">
          <div class="pr-hd-title"><CdIcon icon="lucide:flag" :size="15" /> Review plan</div>
          <button class="pr-x" type="button" aria-label="Close" @click="emit('close')"><CdIcon icon="lucide:x" :size="16" /></button>
        </div>
        <div class="pr-sub">Earnest drafted these from your chat. Tweak the dates and wording, then save.</div>

        <div class="pr-scroll">
          <label class="pr-field pr-name">
            <span class="pr-lbl">Plan name</span>
            <input v-model="planTitle" class="pr-input" type="text" placeholder="Follow-up sequence" />
          </label>

          <div v-for="(r, i) in rows" :key="i" class="pr-task">
            <div class="pr-task-top">
              <span class="pr-step">{{ i + 1 }}</span>
              <input v-model="r.title" class="pr-input pr-task-title" type="text" placeholder="What to do…" />
              <button class="pr-del" type="button" aria-label="Remove" @click="removeRow(i)"><CdIcon icon="lucide:trash-2" :size="14" /></button>
            </div>
            <div class="pr-task-row">
              <input v-model="(r as any)._due" class="pr-input pr-due" type="datetime-local" />
            </div>
            <div class="pr-chips">
              <button
                v-for="c in CHANNELS"
                :key="c.value"
                type="button"
                class="pr-chip"
                :class="{ on: r.channel === c.value }"
                @click="r.channel = r.channel === c.value ? null : c.value"
              >
                <CdIcon :icon="c.icon" :size="12" /> {{ c.label }}
              </button>
            </div>
            <input v-model="r.note" class="pr-input pr-note" type="text" placeholder="Note — what to reference (optional)" />
          </div>

          <button class="pr-add" type="button" @click="addRow"><CdIcon icon="lucide:plus" :size="14" /> Add a task</button>
        </div>

        <div class="pr-foot">
          <button class="pr-cancel" type="button" @click="emit('close')">Cancel</button>
          <button class="pr-save" type="button" :disabled="!canSave || saving" @click="save">
            <CdIcon v-if="saving" icon="lucide:loader-2" :size="15" class="pr-spin" />
            <span v-else>Save plan</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.pr-overlay {
  position: absolute; inset: 0; z-index: 60;
  background: color-mix(in srgb, #000 42%, transparent);
  display: flex; align-items: flex-end; justify-content: center;
}
.pr-sheet {
  width: 100%; max-height: 88%; display: flex; flex-direction: column;
  background: var(--cd-bg); border-top-left-radius: 20px; border-top-right-radius: 20px;
  border: 1px solid var(--cd-bdr); border-bottom: 0;
  box-shadow: 0 -8px 40px color-mix(in srgb, #000 24%, transparent);
}
.pr-grab { width: 40px; height: 4px; border-radius: 2px; background: var(--cd-bdr); margin: 8px auto 4px; flex-shrink: 0; }
.pr-hd { display: flex; align-items: center; justify-content: space-between; padding: 4px var(--cd-gutter) 0; }
.pr-hd-title { display: flex; align-items: center; gap: 7px; font-family: 'Bebas Neue', sans-serif; font-size: 1.3rem; letter-spacing: 0.02em; }
.pr-x { background: none; border: 0; color: var(--cd-muted); cursor: pointer; padding: 4px; }
.pr-sub { padding: 2px var(--cd-gutter) 0; font-size: 0.8rem; color: var(--cd-muted); line-height: 1.4; }

.pr-scroll { flex: 1; overflow-y: auto; padding: 12px var(--cd-gutter); display: flex; flex-direction: column; gap: 12px; }
.pr-field { display: flex; flex-direction: column; gap: 4px; }
.pr-lbl { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--cd-muted); }
.pr-input {
  width: 100%; padding: 9px 11px; border-radius: 10px; border: 1px solid var(--cd-bdr);
  background: var(--cd-bg2); color: var(--cd-text); font-family: inherit; font-size: 0.88rem; outline: none;
}
.pr-input:focus { border-color: var(--cd-accent); }

.pr-task { border: 1px solid var(--cd-bdr); border-radius: 14px; background: var(--cd-bg2); padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.pr-task-top { display: flex; align-items: center; gap: 8px; }
.pr-step {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; font-size: 0.72rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent); color: var(--cd-accent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
}
.pr-task-title { flex: 1; }
.pr-del { flex-shrink: 0; background: none; border: 0; color: var(--cd-dim); cursor: pointer; padding: 4px; }
.pr-del:hover { color: #e5484d; }
.pr-due { color-scheme: dark; }
.pr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pr-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: 999px; cursor: pointer;
  background: var(--cd-bg); border: 1px solid var(--cd-bdr); color: var(--cd-muted);
  font-family: inherit; font-size: 0.72rem; transition: all 0.12s;
}
.pr-chip.on {
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border-color: color-mix(in srgb, var(--cd-accent) 36%, transparent); color: var(--cd-accent);
}
.pr-note { font-size: 0.82rem; }

.pr-add {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px;
  border-radius: 10px; border: 1px dashed var(--cd-bdr); background: none; color: var(--cd-muted);
  font-family: inherit; font-size: 0.8rem; cursor: pointer;
}
.pr-add:hover { border-color: var(--cd-accent); color: var(--cd-accent); }

.pr-foot {
  flex-shrink: 0; display: flex; gap: 10px; padding: 10px var(--cd-gutter) calc(env(safe-area-inset-bottom, 8px) + 10px);
  border-top: 1px solid var(--cd-bdr);
}
.pr-cancel {
  flex: 0 0 auto; padding: 11px 18px; border-radius: 12px; border: 1px solid var(--cd-bdr);
  background: var(--cd-bg2); color: var(--cd-text); font-family: inherit; font-size: 0.88rem; cursor: pointer;
}
.pr-save {
  flex: 1; padding: 11px; border-radius: 12px; border: 0; cursor: pointer;
  background: var(--cd-accent); color: var(--cd-bg); font-family: inherit; font-weight: 700; font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
}
.pr-save:disabled { opacity: 0.45; cursor: not-allowed; }
.pr-spin { animation: pr-spin 0.8s linear infinite; }
@keyframes pr-spin { to { transform: rotate(360deg); } }

.cd-sheet-enter-active, .cd-sheet-leave-active { transition: opacity 0.2s ease; }
.cd-sheet-enter-active .pr-sheet, .cd-sheet-leave-active .pr-sheet { transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1); }
.cd-sheet-enter-from, .cd-sheet-leave-to { opacity: 0; }
.cd-sheet-enter-from .pr-sheet, .cd-sheet-leave-to .pr-sheet { transform: translateY(100%); }
</style>
