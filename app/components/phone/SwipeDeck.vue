<script setup lang="ts">
/**
 * SwipeDeck — the "Network Pulse" card stacks on the Vibe screen. Lays out two
 * independent <SwipeColumn> decks:
 *   • Activity — your network's recent feed events (swipe right to 🔥, tap to react)
 *   • People   — your latest / most-active connections
 *
 * Desktop (≥768px, where the 740px content column has room): both decks sit
 * side-by-side, no tabs. Mobile: a single full-width deck with a tab toggle to
 * switch between Activity and People.
 */
const active = ref<'activity' | 'people'>('activity')
</script>

<template>
  <div class="cd-deck-wrap">
    <div class="cd-deck-hd">
      <div class="cd-deck-title"><CdIcon icon="lucide:layers" :size="13" /> Network Pulse</div>
      <!-- Mobile-only tab toggle (hidden on desktop where both decks show). -->
      <div class="cd-deck-seg" role="tablist">
        <button :class="{ on: active === 'activity' }" role="tab" @click="active = 'activity'">Activity</button>
        <button :class="{ on: active === 'people' }" role="tab" @click="active = 'people'">People</button>
      </div>
    </div>

    <div class="cd-decks">
      <div class="cd-deck-col" :class="{ hide: active !== 'activity' }">
        <div class="cd-deck-col-lbl"><CdIcon icon="lucide:newspaper" :size="11" /> Network Activity</div>
        <PhoneSwipeColumn mode="activity" />
        <div class="cd-deck-foot"><CdIcon icon="lucide:move-horizontal" :size="10" /> Swipe right to 🔥, left to skip</div>
      </div>
      <div class="cd-deck-col" :class="{ hide: active !== 'people' }">
        <div class="cd-deck-col-lbl"><CdIcon icon="lucide:orbit" :size="11" /> People Pulse</div>
        <PhoneSwipeColumn mode="people" />
        <div class="cd-deck-foot"><CdIcon icon="lucide:move-horizontal" :size="10" /> Swipe to browse your network</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-deck-wrap { margin-bottom: 10px; }
.cd-deck-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;
}
.cd-deck-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-dim);
}
.cd-deck-seg {
  display: inline-flex; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 9999px; padding: 2px;
}
.cd-deck-seg button {
  font-family: inherit; font-size: 11px; font-weight: 700; color: var(--cd-dim);
  padding: 4px 12px; border-radius: 9999px; border: none; background: transparent; cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}
.cd-deck-seg button.on { color: var(--cd-bg, #050710); background: var(--cd-accent); }

.cd-decks { display: grid; grid-template-columns: 1fr; gap: 14px; }
.cd-deck-col { min-width: 0; }
.cd-deck-col.hide { display: none; }

/* Per-deck label only matters when both decks are visible (desktop). */
.cd-deck-col-lbl {
  display: none; align-items: center; gap: 5px; margin-bottom: 7px;
  font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.7px; color: var(--cd-dim);
}

.cd-deck-foot {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 8px; font-size: 10px; color: var(--cd-dim);
}

/* Desktop: two decks side-by-side. The shared "Network Pulse" header (+ tabs)
   is hidden; each deck shows its own title instead. */
@media (min-width: 768px) {
  .cd-deck-hd { display: none; }
  .cd-decks { grid-template-columns: 1fr 1fr; gap: 16px; }
  .cd-deck-col.hide { display: block; }
  .cd-deck-col-lbl { display: flex; }
}
</style>
