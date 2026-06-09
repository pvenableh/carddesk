<script setup lang="ts">
import type { ToastType } from '~/composables/useToast'

const { toasts, dismiss } = useToast()

const EMOJI: Record<ToastType, string> = { error: '⚠️', success: '✅', info: 'ℹ️' }
const LUCIDE: Record<ToastType, string> = {
  error: 'lucide:alert-triangle',
  success: 'lucide:check-circle-2',
  info: 'lucide:info',
}
</script>

<template>
  <div class="cd-toast-stack">
    <TransitionGroup name="cd-gt">
      <button
        v-for="t in toasts"
        :key="t.id"
        type="button"
        class="cd-gt"
        :class="`cd-gt-${t.type}`"
        @click="dismiss(t.id)"
      >
        <span class="cd-gt-ico"><CdIcon :emoji="EMOJI[t.type]" :icon="LUCIDE[t.type]" :size="16" /></span>
        <span class="cd-gt-msg">{{ t.message }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.cd-toast-stack {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 8px) + 78px);
  transform: translateX(-50%);
  z-index: 1002;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  width: min(92vw, 420px);
  pointer-events: none;
}
.cd-gt {
  pointer-events: auto;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 13px 15px;
  border-radius: 16px;
  color: var(--cd-text);
  font-family: sans-serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  cursor: pointer;
  /* Non-glass fallback (sleeper theme) */
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.14);
}
/* Match the Vibe-page glass widgets exactly (full-glass material). */
html[data-theme="glass"][data-mode="light"] .cd-gt {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h) var(--glass-s) 60% / 0.10) 0%,
      hsl(var(--glass-h) var(--glass-s) 50% / 0.03) 50%,
      hsl(var(--glass-h2) var(--glass-s) 55% / 0.08) 100%),
    rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid hsl(var(--glass-h) 40% 78% / 0.4);
  box-shadow: var(--glass-inset), var(--glass-shadow-pop);
}
html[data-theme="glass"][data-mode="dark"] .cd-gt {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h) var(--glass-s) 65% / 0.14) 0%,
      hsl(var(--glass-h) var(--glass-s) 45% / 0.05) 50%,
      hsl(var(--glass-h2) var(--glass-s) 50% / 0.10) 100%),
    rgba(30, 30, 34, 0.52);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));
  border: 1px solid hsl(var(--glass-h) 30% 75% / 0.14);
  box-shadow: var(--glass-inset), var(--glass-shadow-pop);
}
.cd-gt-ico { flex-shrink: 0; display: inline-flex; }
.cd-gt-msg { flex: 1; min-width: 0; }
/* Only the icon carries the type colour — no coloured border. */
.cd-gt-error .cd-gt-ico { color: #ef4444; }
.cd-gt-success .cd-gt-ico { color: var(--cd-green); }
.cd-gt-info .cd-gt-ico { color: var(--cd-tough); }

.cd-gt-enter-active { transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1); }
.cd-gt-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; position: absolute; }
.cd-gt-enter-from { opacity: 0; transform: translateY(14px) scale(0.96); }
.cd-gt-leave-to { opacity: 0; transform: translateY(8px) scale(0.97); }
</style>
