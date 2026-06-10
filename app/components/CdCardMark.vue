<script setup lang="ts">
/**
 * The CardDesk "card" mark — a crisp icon-sized imitation of the favicon
 * (public/icons/favicon.svg): a rounded business-card outline with two text
 * lines, strokes filled by the brand aurora (mint → blue → purple).
 *
 * Used for the header's "share my card" button. Set `gradient="false"` to fall
 * back to currentColor (monochrome) so it matches plain icon contexts.
 */
const props = withDefaults(defineProps<{ size?: number; gradient?: boolean }>(), {
  size: 16,
  gradient: true,
})

// SSR-safe unique id so multiple instances don't collide on the gradient def.
const gid = `cd-cardmark-${useId()}`
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <defs v-if="gradient">
      <linearGradient :id="gid" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="hsl(163 100% 45%)" />
        <stop offset="50%" stop-color="hsl(213 85% 58%)" />
        <stop offset="100%" stop-color="hsl(278 85% 60%)" />
      </linearGradient>
    </defs>
    <g
      :stroke="gradient ? `url(#${gid})` : 'currentColor'"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <line x1="6" y1="10" x2="15" y2="10" />
      <line x1="6" y1="13.5" x2="11" y2="13.5" />
    </g>
  </svg>
</template>
