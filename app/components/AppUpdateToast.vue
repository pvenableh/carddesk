<script setup lang="ts">
// "A new version is ready" prompt — the visible half of the update flow.
//
// Detection is app/plugins/app-update.client.ts (six signals: Nuxt's build
// manifest, the x-app-build response header, a /api/version poll, the waiting
// service worker, worker messages after a push, and the cross-tab bus). This
// component only renders the decision and hands the tap to useAppUpdate().
//
// A client that is HIDDEN never gets here — it reloads itself silently. So this
// only ever appears to someone actively looking at the app, and tapping Refresh
// takes every other open tab and window along with it.
//
// Dismissal is in-memory on purpose: backgrounding the app applies the update
// anyway, so there is nothing worth persisting — and no way for this to nag
// across sessions.
const { show, applying, dismissed, applyUpdate, current, latestBuild } = useAppUpdate()

function refresh() {
  // Explicit user intent — this ignores update blockers by design.
  void applyUpdate()
}

// Only useful when someone is debugging a deploy; harmless otherwise.
const debugLine = computed(() =>
  current.value.short ? `${current.value.short} → ${latestBuild.value.slice(0, 7) || 'latest'}` : '',
)
</script>

<template>
  <Transition name="cd-toast">
    <div v-if="show" class="cd-update-toast" role="status" aria-live="polite">
      <span class="cd-update-ico"><CdIcon emoji="✨" icon="lucide:sparkles" :size="18" /></span>
      <div class="cd-update-body">
        <div class="cd-update-title">Update available</div>
        <div class="cd-update-sub">
          A newer version of CardDesk is ready.
          <span v-if="debugLine" class="cd-update-build">{{ debugLine }}</span>
        </div>
      </div>
      <button type="button" class="cd-update-btn" :disabled="applying" @click="refresh">
        {{ applying ? 'Updating…' : 'Refresh' }}
      </button>
      <button type="button" class="cd-update-x" aria-label="Dismiss" @click="dismissed = true">
        <CdIcon emoji="✕" icon="lucide:x" :size="15" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.cd-update-toast {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 8px) + 78px);
  left: 50%;
  transform: translateX(-50%);
  border-radius: 16px;
  padding: 12px 12px 12px 16px;
  display: flex;
  align-items: center;
  gap: 11px;
  z-index: 1003;
  width: min(92vw, 420px);
  color: var(--cd-text);
  /* Non-glass fallback (sleeper theme) */
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.14);
}
/* Match the Vibe-page glass widgets exactly (full-glass material). */
html[data-theme="glass"][data-mode="light"] .cd-update-toast {
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
html[data-theme="glass"][data-mode="dark"] .cd-update-toast {
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
.cd-update-ico { flex-shrink: 0; display: inline-flex; color: var(--cd-tough); }
.cd-update-body { flex: 1; min-width: 0; }
.cd-update-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 17px;
  letter-spacing: 0.5px;
  line-height: 1.05;
}
.cd-update-sub { font-size: 11px; color: var(--cd-muted); font-weight: 600; }
.cd-update-build {
  display: block;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 9px;
  font-weight: 600;
  color: var(--cd-dim);
  letter-spacing: 0.02em;
}
.cd-update-btn {
  flex-shrink: 0;
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 11px;
  border: none;
  font-family: sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--cd-accent, #0a8cf5);
}
.cd-update-btn:disabled { opacity: 0.65; cursor: default; }
.cd-update-x {
  flex-shrink: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--cd-muted);
}
.cd-toast-enter-active { animation: cd-update-in 0.35s cubic-bezier(0.34, 1.4, 0.64, 1); }
.cd-toast-leave-active { transition: opacity 0.25s; }
.cd-toast-leave-to { opacity: 0; }
@keyframes cd-update-in {
  from { opacity: 0; transform: translateX(-50%) translateY(16px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
