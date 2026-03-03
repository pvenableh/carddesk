<script setup lang="ts">
import type { Screen } from '~/composables/useNavigation'

defineProps<{
  active: Screen
  alertCount?: number
}>()

const emit = defineEmits<{
  nav: [screen: Screen]
}>()

const tabs: { key: Screen; icon: string; lucide: string; label: string }[] = [
  { key: 'vibe', icon: '⚡', lucide: 'lucide:zap', label: 'Vibe' },
  { key: 'session', icon: '🎙', lucide: 'lucide:mic', label: 'Session' },
  { key: 'home', icon: '📊', lucide: 'lucide:bar-chart-3', label: 'Stats' },
  { key: 'contacts', icon: '👥', lucide: 'lucide:users', label: 'Network' },
]
</script>

<template>
  <nav class="cd-bnav">
    <button
      v-for="t in tabs.slice(0, 2)"
      :key="t.key"
      class="cd-bn"
      :class="{ on: active === t.key }"
      @click="emit('nav', t.key)"
    >
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
  letter-spacing: 0.6px;
  color: var(--cd-dim);
  transition: color 0.15s;
  font-weight: 700;
  position: relative;
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
  box-shadow: 0 2px 12px rgba(0, 255, 135, 0.3);
  transition: transform 0.15s, box-shadow 0.15s;
  color: #060810;
  font-size: 20px;
}
.cd-bn-scan:hover .cd-scan-btn,
.cd-bn-scan.on .cd-scan-btn {
  transform: scale(1.08);
  box-shadow: 0 4px 18px rgba(0, 255, 135, 0.4);
}
.cd-scan-lbl {
  margin-top: 1px;
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
