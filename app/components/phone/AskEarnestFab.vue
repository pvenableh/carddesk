<script setup lang="ts">
/**
 * Floating "Ask Earnest" button — a compact icon FAB. Opens a chat seeded with
 * context for whatever screen the user is on (see useAskEarnest).
 */
const { visible, ask } = useAskEarnest()
</script>

<template>
  <Transition name="cd-fab">
    <button
      v-if="visible"
      class="cd-ask-fab"
      type="button"
      aria-label="Ask Earnest"
      title="Ask Earnest"
      @click="ask"
    >
      <CdEarnestMark :size="19" mono />
      <span class="cd-ask-fab-tip">Ask Earnest</span>
    </button>
  </Transition>
</template>

<style scoped>
.cd-ask-fab {
  position: fixed;
  right: 16px;
  /* Float just above the bottom nav (its height + home-bar inset). */
  bottom: calc(env(safe-area-inset-bottom, 8px) + 74px);
  z-index: 60;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--cd-accent) 45%, transparent);
  background: var(--cd-accent);
  color: var(--cd-bg);
  cursor: pointer;
  box-shadow:
    0 8px 24px -6px color-mix(in srgb, var(--cd-accent) 50%, transparent),
    0 2px 10px rgba(0, 0, 0, 0.25);
  transition: transform 0.14s ease, box-shadow 0.16s ease, opacity 0.2s ease;
}
.cd-ask-fab:hover {
  transform: translateY(-1px);
  box-shadow:
    0 12px 30px -6px color-mix(in srgb, var(--cd-accent) 60%, transparent),
    0 2px 10px rgba(0, 0, 0, 0.3);
}
.cd-ask-fab:active {
  transform: scale(0.94);
}

/* Hover tooltip (sits to the left of the round button). */
.cd-ask-fab-tip {
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(4px);
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  color: var(--cd-text);
  font-family: sans-serif;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.cd-ask-fab:hover .cd-ask-fab-tip,
.cd-ask-fab:focus-visible .cd-ask-fab-tip {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

/* Enter/leave as the screen changes (and on first show). */
.cd-fab-enter-active,
.cd-fab-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.cd-fab-enter-from,
.cd-fab-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}

/* Phones: tuck a little closer to the edge. */
@media (max-width: 480px) {
  .cd-ask-fab {
    right: 12px;
  }
}
</style>
