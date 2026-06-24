<script setup lang="ts">
/**
 * Horizontal app-like shortcut rail for the top of the Vibe screen. Data and
 * ordering come from useQuickActions; this component is purely presentation.
 */
const { actions } = useQuickActions()
</script>

<template>
  <div class="cd-qar" role="list" aria-label="Quick actions">
    <button
      v-for="a in actions"
      :key="a.id"
      class="cd-qar-item"
      :class="{ on: a.active }"
      :style="{ '--qa-tint': a.tint || 'var(--cd-accent)' }"
      type="button"
      role="listitem"
      :aria-label="a.badge ? `${a.label}, ${a.badge}` : a.label"
      @click="a.run()"
    >
      <span class="cd-qar-tile">
        <span v-if="a.badge" class="cd-qar-badge">{{ a.badge > 99 ? '99+' : a.badge }}</span>
        <CdCardMark v-if="a.mark === 'card'" :size="24" :gradient="false" />
        <CdIcon v-else :icon="a.icon!" :size="24" />
      </span>
      <span class="cd-qar-lbl">{{ a.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.cd-qar {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  /* bleed to the screen edges so the rail reads as a scrollable strip */
  margin: 0 calc(-1 * var(--cd-gutter, 16px)) 12px;
  padding: 2px var(--cd-gutter, 16px) 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.cd-qar::-webkit-scrollbar {
  display: none;
}
.cd-qar-item {
  flex: 0 0 auto;
  width: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  scroll-snap-align: start;
}
.cd-qar-tile {
  position: relative;
  width: 100%;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  /* Per-tile color coding so the rail reads as distinct shortcuts rather than a
     row of identical grey tiles. Tint comes from --qa-tint (set per action). */
  background: color-mix(in srgb, var(--qa-tint, var(--cd-accent)) 11%, var(--cd-bg2));
  border: 1.5px solid color-mix(in srgb, var(--qa-tint, var(--cd-accent)) 32%, var(--cd-bdr));
  color: var(--qa-tint, var(--cd-accent));
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.12s;
}
.cd-qar-item:hover .cd-qar-tile {
  border-color: var(--qa-tint, var(--cd-accent));
  background: color-mix(in srgb, var(--qa-tint, var(--cd-accent)) 18%, var(--cd-bg2));
}
.cd-qar-item:active .cd-qar-tile {
  transform: scale(0.95);
}
/* Active state (e.g. Event mode running): stronger fill so a live mode stands
   out from the other (resting) color-coded tiles. */
.cd-qar-item.on .cd-qar-tile {
  border-color: var(--qa-tint, var(--cd-accent));
  color: var(--qa-tint, var(--cd-accent));
  background: color-mix(in srgb, var(--qa-tint, var(--cd-accent)) 26%, var(--cd-bg2));
}
.cd-qar-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--qa-tint, var(--cd-accent));
  color: var(--cd-bg);
  font-family: sans-serif;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  border: 2px solid var(--cd-bg);
}
.cd-qar-lbl {
  font-size: 11px;
  font-weight: 600;
  font-family: sans-serif;
  color: var(--cd-muted);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cd-qar-item.on .cd-qar-lbl {
  color: var(--qa-tint, var(--cd-accent));
  font-weight: 700;
}
</style>
