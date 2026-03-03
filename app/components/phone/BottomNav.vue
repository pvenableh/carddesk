<script setup lang="ts">
import type { Screen } from '~/composables/useNavigation'

defineProps<{
  active: Screen
  alertCount?: number
}>()

const emit = defineEmits<{
  nav: [screen: Screen]
}>()

const tabs: { key: Screen; icon: string; label: string }[] = [
  { key: 'vibe', icon: '⚡', label: 'Vibe' },
  { key: 'session', icon: '🎙', label: 'Session' },
  { key: 'cold', icon: '❄️', label: 'Cold' },
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'contacts', icon: '👥', label: 'Network' },
]
</script>

<template>
  <nav class="cd-bnav">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="cd-bn"
      :class="{ on: active === t.key }"
      @click="emit('nav', t.key)"
    >
      <span v-if="t.key === 'contacts' && alertCount" class="cd-nav-dot"></span>
      <span class="cd-bni">{{ t.icon }}</span>{{ t.label }}
    </button>
  </nav>
</template>

<style scoped>
.cd-bnav {
  display: flex;
  background: rgba(6, 8, 16, 0.97);
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
