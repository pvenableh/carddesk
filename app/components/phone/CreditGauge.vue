<script setup lang="ts">
/**
 * Standalone circular AI-credit gauge for the header. Ring fill + colour track
 * remaining credits (green → amber → red). Centre shows the credit count
 * (standalone) or % remaining (org with a token limit). Tapping opens the
 * top-up modal for standalone users.
 */
const { state, gaugePct, gaugeColor, isOrg, loadCredits, openBuyModal } = useCredits()

onMounted(() => { if (!state.value.loaded) loadCredits() })

const centerText = computed(() => {
  const s = state.value
  if (s.source === 'org') {
    if (s.unlimited || s.tokenLimit == null || s.tokenLimit <= 0) return '∞'
    return `${Math.round(gaugePct.value * 100)}%`
  }
  return String(s.credits ?? 0)
})

function onTap() {
  if (!isOrg.value) openBuyModal()
}
</script>

<template>
  <button class="cd-gauge" :aria-label="`AI credits: ${centerText}`" @click="onTap">
    <svg class="cd-gauge-ring" viewBox="0 0 36 36">
      <!-- subtle filled background (matches the sibling header buttons) -->
      <circle cx="18" cy="18" r="16.5" fill="var(--cd-bg2)" />
      <!-- unused track: a faint tint of the level colour so the arc stands out -->
      <circle cx="18" cy="18" r="15.5" fill="none" :stroke="gaugeColor" stroke-opacity="0.2" stroke-width="2.5" />
      <!-- remaining credits -->
      <circle
        cx="18" cy="18" r="15.5" fill="none" :stroke="gaugeColor" stroke-width="2.5" stroke-linecap="round"
        :stroke-dasharray="97.4" :stroke-dashoffset="97.4 - 97.4 * gaugePct" transform="rotate(-90 18 18)"
        style="transition: stroke-dashoffset 0.5s ease, stroke 0.3s ease"
      />
    </svg>
    <span class="cd-gauge-val" :style="{ color: gaugeColor }">{{ centerText }}</span>
  </button>
</template>

<style scoped>
.cd-gauge {
  position: relative;
  width: 34px;
  height: 34px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  flex-shrink: 0;
}
.cd-gauge-ring {
  position: absolute;
  inset: 0;
  width: 34px;
  height: 34px;
}
.cd-gauge-val {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 800;
  font-family: monospace;
  font-variant-numeric: tabular-nums;
}
</style>
