<script setup lang="ts">
/**
 * Bottom sheet: slides up on open, down on close, over a blurred scrim.
 * The scrim is clickable to dismiss, and on touch the panel can be
 * swiped down to close (drag follows the finger, releases past a threshold).
 *
 * Usage:
 *   <PhoneSheet v-model:open="showThing">
 *     ...panel content...
 *   </PhoneSheet>
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    /** Panel inner padding — a few sheets want a touch more breathing room. */
    padding?: string
    /** Max panel width (matches the phone frame by default). */
    maxWidth?: string
    /** How far you must drag down (px) before release dismisses. */
    closeThreshold?: number
  }>(),
  { padding: '16px', maxWidth: '768px', closeThreshold: 90 },
)

const emit = defineEmits<{ 'update:open': [boolean] }>()

function close() {
  emit('update:open', false)
}

// ── Swipe-to-dismiss ──────────────────────────────────────────────
const dragY = ref(0)
const dragging = ref(false)
let startY = 0

function onPointerDown(e: PointerEvent) {
  // Only a primary press, and never when starting on something interactive
  // (buttons/inputs) or inside a scrollable region — those own the gesture.
  if (e.button != null && e.button !== 0) return
  const t = e.target as HTMLElement
  if (t.closest('button, input, textarea, select, a, [data-no-drag]')) return
  dragging.value = true
  dragY.value = 0
  startY = e.clientY
  // Listen on window so a fast drag that leaves the panel still delivers
  // move/up — more reliable than pointer capture across browsers.
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  // Only track downward movement; upward drags do nothing.
  dragY.value = Math.max(0, e.clientY - startY)
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  if (!dragging.value) return
  const shouldClose = dragY.value > props.closeThreshold
  // Drop finger-follow mode so the panel animates smoothly from here. The
  // leave classes are !important, so they override the drag transform below
  // and slide the panel the rest of the way out.
  dragging.value = false
  if (shouldClose) {
    close()
    // Reset the offset once the leave has unmounted the panel.
    window.setTimeout(() => (dragY.value = 0), 360)
  } else {
    // Spring back: re-enabling the transition (dragging→false) then zeroing
    // the offset next frame lets it glide home instead of snapping.
    requestAnimationFrame(() => (dragY.value = 0))
  }
}

const panelStyle = computed(() => {
  const base = { maxWidth: props.maxWidth, padding: props.padding } as Record<string, string>
  if (dragY.value > 0) {
    base.transform = `translateY(${dragY.value}px)`
    // No transition while the finger drives it; the base CSS transition takes
    // over on release for the glide-back / glide-out.
    if (dragging.value) base.transition = 'none'
  }
  return base
})

// Scrim dims/undims as you drag so the dismiss feels connected.
const scrimStyle = computed(() =>
  dragging.value
    ? { opacity: String(Math.max(0.15, 1 - dragY.value / 320)), transition: 'none' }
    : {},
)

// ── Lock background scroll while open ─────────────────────────────
watch(
  () => props.open,
  (v) => {
    if (import.meta.client) document.documentElement.style.overflow = v ? 'hidden' : ''
  },
)
onBeforeUnmount(() => {
  if (import.meta.client) {
    document.documentElement.style.overflow = ''
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cd-sheet">
      <div v-if="open" class="cd-sheet-root" @click.self="close" @keydown.esc="close">
        <div class="cd-sheet-scrim" :style="scrimStyle" />
        <div
          class="cd-sheet-panel"
          :style="panelStyle"
          @pointerdown="onPointerDown"
        >
          <div class="cd-sheet-grip" aria-hidden="true" />
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cd-sheet-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Blurred, dimmed backdrop. pointer-events: none so background clicks fall
 * through to the root, whose @click.self closes the sheet. */
.cd-sheet-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(6px) saturate(120%);
  -webkit-backdrop-filter: blur(6px) saturate(120%);
  /* Eases the dim back after a partial swipe; the drag itself overrides this
   * with an inline transition: none so it tracks the finger 1:1. */
  transition: opacity 0.25s ease;
}

.cd-sheet-panel {
  position: relative;
  width: 100%;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-bottom: none;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.28);
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
  touch-action: pan-y;
}

.cd-sheet-grip {
  width: 36px;
  height: 4px;
  border-radius: 9999px;
  background: var(--cd-bdr);
  margin: -4px auto 10px;
}

/* Enter/leave.
 * The fade is on the ROOT so Vue measures *its* duration to time the unmount —
 * if we only transitioned the children, a drag transform pinned on the panel
 * (inline styles outrank the leave-to class) would freeze the exit and the
 * sheet would never unmount. The root fade also dims the whole overlay; the
 * panel additionally slides. */
.cd-sheet-enter-active,
.cd-sheet-leave-active {
  transition: opacity 0.32s ease;
}
.cd-sheet-enter-from,
.cd-sheet-leave-to {
  opacity: 0;
}
.cd-sheet-enter-active .cd-sheet-panel,
.cd-sheet-leave-active .cd-sheet-panel {
  transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1) !important;
}
.cd-sheet-enter-from .cd-sheet-panel,
.cd-sheet-leave-to .cd-sheet-panel {
  transform: translateY(100%) !important;
}
.cd-sheet-leave-active {
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .cd-sheet-panel,
  .cd-sheet-enter-active,
  .cd-sheet-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
