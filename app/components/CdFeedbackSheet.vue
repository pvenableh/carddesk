<script setup lang="ts">
/**
 * Slide-up feedback sheet. Mounted globally in app.vue so it overlays whatever
 * the user is doing — pick bug / idea / other, type, submit, and you're dropped
 * right back where you were. Posts via useFeedback() to the existing cd_feedback
 * collection (auth required).
 */
const { open, kind, hide } = useFeedbackSheet()
const { submitting, submitReport } = useFeedback()
const { success, error: showError } = useToast()

const message = ref('')

const KINDS = [
  { key: 'bug', label: 'Bug', icon: 'lucide:bug' },
  { key: 'idea', label: 'Idea', icon: 'lucide:lightbulb' },
  { key: 'other', label: 'Other', icon: 'lucide:message-circle' },
] as const

const placeholder = computed(() =>
  kind.value === 'bug'
    ? 'What went wrong? What were you doing when it happened?'
    : kind.value === 'idea'
      ? 'What would make CardDesk better?'
      : 'What\'s on your mind?'
)

// Reset the draft whenever the sheet opens fresh.
watch(open, (isOpen) => { if (isOpen) message.value = '' })

async function submit() {
  try {
    await submitReport(kind.value, message.value)
    success('Thanks — your feedback is on its way to us.')
    hide()
  } catch (err: any) {
    showError(err?.data?.message || err?.message || 'Couldn\'t send that — try again.')
  }
}
</script>

<template>
  <Transition name="cd-fb">
    <div v-if="open" class="cd-fb-ov" @click.self="hide">
      <div class="cd-fb-sheet">
        <div class="cd-fb-grip" />
        <button class="cd-fb-x" aria-label="Close" @click="hide"><CdIcon emoji="×" icon="lucide:x" :size="18" /></button>

        <div class="cd-fb-title"><CdIcon icon="lucide:message-square-plus" :size="16" /> Send feedback</div>
        <div class="cd-fb-sub">Found a bug or have an idea? It goes straight to the team.</div>

        <div class="cd-fb-kinds">
          <button
            v-for="k in KINDS"
            :key="k.key"
            class="cd-fb-kind"
            :class="{ active: kind === k.key }"
            @click="kind = k.key"
          >
            <CdIcon :icon="k.icon" :size="14" /> {{ k.label }}
          </button>
        </div>

        <textarea
          v-model="message"
          class="cd-fb-input"
          rows="4"
          :placeholder="placeholder"
        ></textarea>

        <button class="cd-abtn g cd-fb-send" :disabled="submitting || !message.trim()" @click="submit">
          {{ submitting ? 'Sending…' : 'Send feedback' }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cd-fb-ov {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 220;
}
.cd-fb-sheet {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: var(--cd-bg);
  border: 1px solid var(--cd-bdr);
  border-bottom: none;
  border-radius: 22px 22px 0 0;
  padding: 14px 20px calc(env(safe-area-inset-bottom, 12px) + 18px);
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.4);
}
.cd-fb-grip {
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background: var(--cd-bdr);
  margin: 0 auto 14px;
}
.cd-fb-x {
  position: absolute;
  top: 14px;
  right: 14px;
  background: none;
  border: none;
  color: var(--cd-dim);
  cursor: pointer;
}
.cd-fb-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 16px;
  font-weight: 800;
  color: var(--cd-text);
}
.cd-fb-sub {
  font-size: 12px;
  color: var(--cd-muted);
  margin: 4px 0 14px;
  line-height: 1.45;
}
.cd-fb-kinds {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.cd-fb-kind {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg2);
  color: var(--cd-muted);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.cd-fb-kind:hover { color: var(--cd-text); }
.cd-fb-kind.active {
  border-color: var(--cd-accent);
  color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 10%, transparent);
}
.cd-fb-input {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 92px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg2);
  color: var(--cd-text);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.45;
  outline: none;
  margin-bottom: 12px;
}
.cd-fb-input:focus { border-color: var(--cd-accent); }
.cd-fb-send {
  width: 100%;
  justify-content: center;
  font-size: 15px;
  padding: 13px;
}
.cd-fb-send:disabled { opacity: 0.5; cursor: not-allowed; }

/* slide-up + fade */
.cd-fb-enter-active, .cd-fb-leave-active { transition: opacity 0.22s ease; }
.cd-fb-enter-active .cd-fb-sheet, .cd-fb-leave-active .cd-fb-sheet {
  transition: transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.cd-fb-enter-from, .cd-fb-leave-to { opacity: 0; }
.cd-fb-enter-from .cd-fb-sheet, .cd-fb-leave-to .cd-fb-sheet { transform: translateY(100%); }
</style>
