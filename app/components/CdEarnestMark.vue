<script setup lang="ts">
/**
 * The Earnest "E" mark — a faithful icon-sized recreation of Earnest's official
 * favicon (earnest/public/favicon.svg): the stylized serif "E" glyph with the
 * signature cyan dot. Used anywhere CardDesk surfaces the Earnest name or
 * Earnest-powered AI (the "Ask Earnest" FAB, the AI chat, "Get Earnest AI
 * Ideas", "Who is Earnest?", etc.) in place of a generic sparkles icon.
 *
 * The glyph inherits `currentColor` so it matches its button/text context. The
 * dot keeps Earnest's brand cyan by default; set `mono` to fold it into
 * currentColor for single-color contexts (e.g. on a solid accent button).
 *
 * The viewBox is tightened to the artwork bounds so the mark fills its icon box
 * like other Lucide icons, rather than floating small inside the 700×700 source.
 */
withDefaults(defineProps<{ size?: number | string; mono?: boolean }>(), {
  size: 16,
  mono: false,
})
</script>

<template>
  <svg :width="size" :height="size" viewBox="108 112 498 477" fill="none" aria-hidden="true">
    <!-- "E" glyph (verbatim from Earnest's favicon) -->
    <path
      fill="currentColor"
      d="M174.431 562.477V132.244H118V122H459.792L467.488 230.839H457.227C457.227 157.213 408.491 132.244 340.518 132.244H239.84V338.397H287.934C354.625 338.397 361.038 298.063 361.038 256.448H371.298V426.749H361.038C361.038 378.091 354.625 348.641 287.293 348.641H239.84V562.477H327.692C431.577 562.477 481.595 550.313 481.595 441.474H491.855V572.721H118V562.477H174.431Z"
    />
    <!-- Signature dot -->
    <circle :fill="mono ? 'currentColor' : '#00BFFF'" cx="560.591" cy="543.367" r="35.4" />
  </svg>
</template>
