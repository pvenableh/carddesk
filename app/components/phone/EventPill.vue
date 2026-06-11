<script setup lang="ts">
/**
 * Ambient Event Mode indicator. Event Mode is a *state*, not a place — while an
 * event is live this slim banner rides under the header on every screen (except
 * the event screen itself), showing the live count and giving a one-tap way
 * back to the capture loop. Without it, leaving the event tab used to mean the
 * mode silently kept tagging contacts with no visible sign it was on.
 */
const { active, name, count } = useEventMode()
const { screen, nav } = useNavigation()

const show = computed(() => active.value && screen.value !== 'event')
</script>

<template>
  <Transition name="cd-eventpill">
    <button v-if="show" class="cd-event-pill" type="button" @click="nav('event')">
      <span class="cd-ep-live"></span>
      <span class="cd-ep-name">{{ name }}</span>
      <span class="cd-ep-count">{{ count }} met</span>
      <CdIcon icon="lucide:chevron-right" :size="13" />
    </button>
  </Transition>
</template>

<style scoped>
.cd-event-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  flex-shrink: 0;
  padding: 7px 14px;
  padding-left: max(14px, env(safe-area-inset-left, 0px));
  padding-right: max(14px, env(safe-area-inset-right, 0px));
  background: color-mix(in srgb, var(--cd-accent) 10%, var(--cd-bg));
  border: none;
  border-bottom: 1px solid color-mix(in srgb, var(--cd-accent) 28%, transparent);
  color: var(--cd-text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  z-index: 9;
}
.cd-ep-live {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--cd-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--cd-accent) 70%, transparent);
  animation: cd-ep-pulse 1.6s ease-in-out infinite;
}
@keyframes cd-ep-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
.cd-ep-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cd-ep-count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--cd-accent);
}
.cd-eventpill-enter-active,
.cd-eventpill-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.cd-eventpill-enter-from,
.cd-eventpill-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
