<script setup lang="ts">
import type { Screen } from '~/composables/useNavigation'

const props = defineProps<{
  active: Screen
  alertCount?: number
}>()

const emit = defineEmits<{
  nav: [screen: Screen]
}>()

// 5-slot bar: 2 tabs, the scan button, 2 tabs. Session and Event Mode are no
// longer tabs — Session is reached from Vibe, Event Mode is a state entered
// from Vibe/scan (an app-wide pill shows while it's active).
const tabs: { key: Screen; icon: string; lucide: string; label: string }[] = [
  { key: 'vibe', icon: '⚡', lucide: 'lucide:zap', label: 'Vibe' },
  { key: 'contacts', icon: '👥', lucide: 'lucide:users', label: 'Network' },
  { key: 'feed', icon: '📰', lucide: 'lucide:newspaper', label: 'Feed' },
  { key: 'home', icon: '📊', lucide: 'lucide:bar-chart-3', label: 'Stats' },
]

// Left-to-right order of the five nav slots (2 tabs, scan, 2 tabs). Drives the
// sliding top-highlight: its index sets the indicator's horizontal position, and
// CSS animates `left` so the line glides to the active page on every change.
const NAV_ORDER: Screen[] = ['vibe', 'contacts', 'add', 'feed', 'home']
const activeIndex = computed(() => NAV_ORDER.indexOf(props.active))
</script>

<template>
  <nav class="cd-bnav">
    <!-- Sliding highlight that rides above whichever tab is active. Hidden on the
         scan slot (index 2), which shows its own glow ring instead. -->
    <span
      class="cd-nav-indicator"
      :class="{ hidden: activeIndex < 0 || activeIndex === 2 }"
      :style="{ left: `calc(${activeIndex} * (100% / 5))` }"
    ></span>

    <button
      v-for="t in tabs.slice(0, 2)"
      :key="t.key"
      class="cd-bn"
      :class="{ on: active === t.key }"
      @click="emit('nav', t.key)"
    >
      <span v-if="t.key === 'contacts' && alertCount" class="cd-nav-dot"></span>
      <span class="cd-bni"><CdIcon :emoji="t.icon" :icon="t.lucide" /></span>{{ t.label }}
    </button>

    <button
      class="cd-bn cd-bn-scan"
      :class="{ on: active === 'add' }"
      @click="emit('nav', 'add')"
    >
      <span class="cd-scan-btn"><CdIcon emoji="📷" icon="lucide:scan" :size="20" /></span>
      <span class="cd-scan-lbl">Scan</span>
    </button>

    <button
      v-for="t in tabs.slice(2)"
      :key="t.key"
      class="cd-bn"
      :class="{ on: active === t.key }"
      @click="emit('nav', t.key)"
    >
      <span v-if="t.key === 'contacts' && alertCount" class="cd-nav-dot"></span>
      <span class="cd-bni"><CdIcon :emoji="t.icon" :icon="t.lucide" /></span>{{ t.label }}
    </button>
  </nav>
</template>

<style scoped>
.cd-bnav {
  display: flex;
  background: color-mix(in srgb, var(--cd-bg) 97%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid var(--cd-bdr);
  padding: 7px 0 calc(env(safe-area-inset-bottom, 8px) + 4px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  flex-shrink: 0;
  z-index: 10;
  position: relative;
}
/* Sliding top-highlight over the active tab. One slot = 1/5 of the bar; the
   inline `left` sets the slot and the transition glides it on page change. */
.cd-nav-indicator {
  position: absolute;
  top: 0;
  box-sizing: border-box;
  width: calc(100% / 5);
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--cd-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--cd-accent) 60%, transparent);
  /* inset the visible line within its 1/5 slot so it sits centred over the icon */
  border-left: 26px solid transparent;
  border-right: 26px solid transparent;
  background-clip: padding-box;
  transition: left 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s;
  pointer-events: none;
}
.cd-nav-indicator.hidden {
  opacity: 0;
}
.cd-bn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 9px;
  font-family: sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--cd-dim);
  transition: color 0.15s;
  font-weight: 700;
  position: relative;
  white-space: nowrap;
  min-width: 0;
}
.cd-bn.on,
.cd-bn:hover {
  color: var(--cd-accent);
}
.cd-bni {
  font-size: 18px;
  line-height: 1.1;
}
.cd-bn-scan {
  position: relative;
}
.cd-scan-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--cd-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -22px;
  box-shadow: 0 2px 12px color-mix(in srgb, var(--cd-accent) 30%, transparent);
  transition: transform 0.15s, box-shadow 0.15s;
  color: #060810;
  font-size: 20px;
}
.cd-bn-scan:hover .cd-scan-btn {
  transform: scale(1.08);
  box-shadow: 0 4px 18px color-mix(in srgb, var(--cd-accent) 40%, transparent);
}
/* Active scan page: the circle shrinks a touch so its gap-ring + glow sit inside
   the button's footprint instead of overlapping the "Scan" label below it. */
.cd-bn-scan.on .cd-scan-btn {
  transform: scale(0.82);
  box-shadow:
    0 0 0 2px var(--cd-bg),
    0 0 0 4px var(--cd-accent),
    0 0 12px 2px color-mix(in srgb, var(--cd-accent) 50%, transparent);
  animation: cd-scan-pulse 1.8s ease-in-out infinite;
}
@keyframes cd-scan-pulse {
  0%, 100% {
    box-shadow:
      0 0 0 2px var(--cd-bg),
      0 0 0 4px var(--cd-accent),
      0 0 11px 2px color-mix(in srgb, var(--cd-accent) 42%, transparent);
  }
  50% {
    box-shadow:
      0 0 0 2px var(--cd-bg),
      0 0 0 4px var(--cd-accent),
      0 0 17px 4px color-mix(in srgb, var(--cd-accent) 65%, transparent);
  }
}
.cd-scan-lbl {
  margin-top: 3px;
}
.cd-nav-dot {
  position: absolute;
  top: 0;
  right: calc(50% - 16px);
  width: 7px;
  height: 7px;
  background: #ff6b35;
  border-radius: 50%;
  border: 2px solid var(--cd-bg);
  animation: cd-blink 2s infinite;
}
@keyframes cd-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
