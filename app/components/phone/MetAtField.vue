<script setup lang="ts">
/**
 * "Where We Met" field with a one-tap picker of the user's events. The list is
 * every distinct `met_at` across their network (plus the live event, surfaced
 * first) — so tagging a contact to an existing event, or moving them between
 * events, is a tap instead of retyping an exact name and risking a typo that
 * silently orphans them. Plain text entry still works for brand-new places.
 */
const props = defineProps<{
  modelValue: string
  label?: string
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const { knownPlaces } = useEventMode()

const val = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
})

// Cap the strip so a long history doesn't dominate the form.
const suggestions = computed(() => knownPlaces.value.slice(0, 8))

function pick(name: string) {
  // Tapping the already-selected chip clears it (so you can untag).
  val.value = val.value === name ? '' : name
}
</script>

<template>
  <div class="metat">
    <label class="cd-lbl">{{ label || 'Where We Met' }}</label>
    <input v-model="val" class="cd-inp" :placeholder="placeholder || 'SaaS Summit NYC'" />
    <div v-if="suggestions.length" class="metat-chips" role="listbox" aria-label="Your events">
      <button
        v-for="s in suggestions"
        :key="s.name"
        type="button"
        class="metat-chip"
        :class="{ on: val === s.name, live: s.active }"
        role="option"
        :aria-selected="val === s.name"
        @click="pick(s.name)"
      >
        <span v-if="s.active" class="metat-live"></span>
        <CdIcon v-else icon="lucide:calendar-check" :size="10" />
        <span class="metat-chip-name">{{ s.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.metat { min-width: 0; }
.metat-chips {
  display: flex;
  gap: 6px;
  /* The input above already carries an 8px bottom margin; keep a small top gap
     and a clear bottom gap so the chips don't crowd the next field/label. */
  margin-top: 2px;
  margin-bottom: 10px;
  /* A long event history scrolls horizontally rather than wrapping into a tall
     block (chips are flex-shrink:0). The list is also capped at 8 entries. */
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.metat-chips::-webkit-scrollbar { display: none; }
.metat-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 160px;
  padding: 5px 11px;
  border-radius: 999px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  color: var(--cd-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.metat-chip :deep(svg) { flex-shrink: 0; color: var(--cd-dim); }
.metat-chip-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.metat-chip:hover { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.metat-chip.on {
  border-color: var(--cd-accent);
  color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
}
.metat-chip.on :deep(svg) { color: var(--cd-accent); }
/* The currently-live event gets a pulsing dot instead of the calendar icon. */
.metat-live {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--cd-accent);
  box-shadow: 0 0 7px color-mix(in srgb, var(--cd-accent) 70%, transparent);
  animation: metat-pulse 1.6s ease-in-out infinite;
}
.metat-chip.live { color: var(--cd-accent); border-color: color-mix(in srgb, var(--cd-accent) 34%, transparent); }
@keyframes metat-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
</style>
