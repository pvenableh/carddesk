<script setup lang="ts">
/**
 * Shared avatar. Always a PERFECT CIRCLE — the single home for avatar shape so
 * individual screens no longer hand-roll rounded squares. Render priority:
 *   1. `src`      → the uploaded photo, cover-filling the circle
 *   2. `industry` → the industry glyph, tinted its color on a soft disc
 *   3. `name`     → initials
 * When `ring` is set and the contact has an industry, it wears the same
 * industry-colored border + soft ring as ContactsScreen's avatarRing().
 */
const props = withDefaults(
  defineProps<{
    src?: string | null
    name?: string | null
    industry?: string | null
    size?: number
    ring?: boolean
  }>(),
  { size: 40, ring: false },
)

const col = computed(() => industryColor(props.industry))
const glyph = computed(() => industryIcon(props.industry))

const initials = computed(() => {
  const parts = (props.name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  return (parts[0]![0]! + (parts[1]?.[0] ?? '')).toUpperCase()
})

const boxStyle = computed(() => {
  const px = `${props.size}px`
  const s: Record<string, string> = { width: px, height: px }
  // Ring keyed to the contact's industry: colored border + soft ring via
  // box-shadow (never shifts layout under overflow:hidden). Mirrors avatarRing().
  if (props.ring && col.value) {
    s.borderColor = col.value
    s.boxShadow = `0 0 0 1.5px color-mix(in srgb, ${col.value} 38%, transparent)`
  }
  // Industry-icon fallback sits on a disc tinted its color.
  if (!props.src && glyph.value && col.value) {
    s.background = `color-mix(in srgb, ${col.value} 12%, var(--cd-bg2))`
  }
  return s
})

const iconSize = computed(() => Math.round(props.size * 0.48))
</script>

<template>
  <span class="cd-avatar" :style="boxStyle" :title="industry || undefined">
    <img v-if="src" :src="src" alt="" />
    <CdIcon
      v-else-if="glyph"
      :icon="glyph"
      :size="iconSize"
      :style="{ color: col || undefined }"
    />
    <span v-else-if="initials" class="cd-avatar-ini" :style="{ fontSize: `${iconSize * 0.8}px` }">{{ initials }}</span>
    <CdIcon v-else icon="lucide:user" :size="iconSize" />
  </span>
</template>

<style scoped>
.cd-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--cd-avatar-radius, 50%);
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  overflow: hidden;
  color: var(--cd-muted);
}
.cd-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}
.cd-avatar-ini {
  font-weight: 800;
  color: var(--cd-text);
  line-height: 1;
}
</style>
