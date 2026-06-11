<script setup lang="ts">
/**
 * Hover/focus tooltip styled to match the floating "Ask Earnest" FAB tip —
 * a small glass bubble (cd-bg2 + border + soft shadow) that fades in. Wrap any
 * trigger: `<CdTooltip label="…"><button>…</button></CdTooltip>`.
 *
 * `placement` picks the side; `wrap` lets long content (e.g. a list of names)
 * break onto multiple lines instead of the default single-line nowrap.
 * An empty `label` renders the trigger with no bubble.
 */
withDefaults(defineProps<{
  label?: string | null
  placement?: 'top' | 'bottom' | 'bottom-end' | 'left'
  wrap?: boolean
}>(), { placement: 'bottom', wrap: false })
</script>

<template>
  <span class="cd-tt" :class="`cd-tt--${placement}`">
    <slot />
    <span v-if="label" class="cd-tt-bub" :class="{ 'cd-tt-bub--wrap': wrap }" role="tooltip">{{ label }}</span>
  </span>
</template>

<style scoped>
.cd-tt {
  position: relative;
  display: inline-flex;
}
.cd-tt-bub {
  position: absolute;
  z-index: 200;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  color: var(--cd-text);
  font-family: sans-serif;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.cd-tt-bub--wrap {
  white-space: normal;
  width: max-content;
  max-width: 220px;
  text-align: center;
}

/* ── Bottom (centered under the trigger) ── */
.cd-tt--bottom .cd-tt-bub {
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
}
.cd-tt--bottom:hover .cd-tt-bub,
.cd-tt--bottom:focus-within .cd-tt-bub {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ── Bottom, right-aligned to the trigger (for edge-of-screen buttons) ── */
.cd-tt--bottom-end .cd-tt-bub {
  top: calc(100% + 8px);
  right: 0;
  transform: translateY(-4px);
}
.cd-tt--bottom-end:hover .cd-tt-bub,
.cd-tt--bottom-end:focus-within .cd-tt-bub {
  opacity: 1;
  transform: translateY(0);
}

/* ── Top (centered above the trigger) ── */
.cd-tt--top .cd-tt-bub {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
}
.cd-tt--top:hover .cd-tt-bub,
.cd-tt--top:focus-within .cd-tt-bub {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ── Left (to the side, like the FAB) ── */
.cd-tt--left .cd-tt-bub {
  right: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%) translateX(4px);
}
.cd-tt--left:hover .cd-tt-bub,
.cd-tt--left:focus-within .cd-tt-bub {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}
</style>
