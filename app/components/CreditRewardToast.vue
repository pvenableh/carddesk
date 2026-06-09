<script setup lang="ts">
import confettiLib from 'canvas-confetti'

const { rewardToast } = useCredits()

watch(rewardToast, (v) => {
  if (v && import.meta.client) {
    confettiLib({
      particleCount: 70,
      spread: 75,
      origin: { y: 0.7 },
      colors: ['#0a8cf5', '#00ff87', '#ffd700', '#4da6ff'],
    })
  }
})
</script>

<template>
  <Transition name="cd-toast">
    <div v-if="rewardToast" class="cd-reward-toast">
      <span style="font-size: 20px"><CdIcon emoji="🎁" icon="lucide:gift" :size="20" /></span>
      <div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: var(--cd-green); letter-spacing: 1px; line-height: 1.05">
          +{{ rewardToast.added }} credits
        </div>
        <div style="font-size: 11px; color: var(--cd-muted); font-weight: 600">{{ rewardToast.labels.join(' · ') }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cd-reward-toast {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 8px) + 78px);
  left: 50%;
  transform: translateX(-50%);
  border-radius: 16px;
  padding: 13px 18px;
  display: flex;
  align-items: center;
  gap: 11px;
  z-index: 1001;
  max-width: calc(100vw - 32px);
  color: var(--cd-text);
  /* Non-glass fallback (sleeper theme) */
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.14);
}
/* Match the Vibe-page glass widgets exactly (full-glass material). */
html[data-theme="glass"][data-mode="light"] .cd-reward-toast {
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
html[data-theme="glass"][data-mode="dark"] .cd-reward-toast {
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
.cd-toast-enter-active { animation: cd-reward-in 0.35s cubic-bezier(0.34, 1.4, 0.64, 1); }
.cd-toast-leave-active { transition: opacity 0.25s; }
.cd-toast-leave-to { opacity: 0; }
@keyframes cd-reward-in {
  from { opacity: 0; transform: translateX(-50%) translateY(16px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
