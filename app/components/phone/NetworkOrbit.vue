<script setup lang="ts">
import type { NetworkConnection } from '~/composables/useConnections'

const props = defineProps<{
  connections: NetworkConnection[]
  me: { name: string; level: number }
}>()

const emit = defineEmits<{ select: [c: NetworkConnection] }>()

const PER_RING = 8
const R0 = 95
const RSTEP = 58
const NODE = 22

function hue(s: string): number {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}

const nodes = computed(() =>
  props.connections.map((c, i) => {
    const ring = Math.floor(i / PER_RING)
    const inRing = Math.min(PER_RING, props.connections.length - ring * PER_RING)
    const pos = i % PER_RING
    const r = R0 + ring * RSTEP
    // stagger each ring's start angle so outer nodes don't sit directly behind inner ones
    const angle = (pos / inRing) * Math.PI * 2 + ring * 0.6 - Math.PI / 2
    return { c, x: Math.cos(angle) * r, y: Math.sin(angle) * r, color: `hsl(${hue(c.user.name)} 65% 55%)` }
  })
)

// Auto-size the viewBox so any number of rings fits.
const half = computed(() => {
  const maxRing = props.connections.length ? Math.floor((props.connections.length - 1) / PER_RING) : 0
  return R0 + maxRing * RSTEP + NODE + 12
})
const viewBox = computed(() => `${-half.value} ${-half.value} ${half.value * 2} ${half.value * 2}`)
const meInitials = computed(() => initials(props.me.name || 'You'))
</script>

<template>
  <div class="orbit-wrap">
    <svg :viewBox="viewBox" class="orbit-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="cd-orbit-clip"><circle cx="0" cy="0" :r="NODE" /></clipPath>
      </defs>
      <g class="orbit-rot">
        <!-- connecting lines -->
        <line
          v-for="n in nodes"
          :key="'l' + n.c.id"
          x1="0" y1="0" :x2="n.x" :y2="n.y"
          :stroke="n.color" stroke-width="1.5" stroke-opacity="0.35"
        />
        <!-- connection nodes -->
        <g v-for="n in nodes" :key="n.c.id" :transform="`translate(${n.x} ${n.y})`" class="orbit-node" @click="emit('select', n.c)">
          <g class="orbit-node-inner">
            <circle v-if="!n.c.user.avatarUrl" :r="NODE" :fill="n.color" fill-opacity="0.18" />
            <image v-else :href="n.c.user.avatarUrl" :x="-NODE" :y="-NODE" :width="NODE * 2" :height="NODE * 2" clip-path="url(#cd-orbit-clip)" preserveAspectRatio="xMidYMid slice" />
            <circle :r="NODE" fill="none" :stroke="n.color" stroke-width="1.5" />
            <text v-if="!n.c.user.avatarUrl" text-anchor="middle" dy="0.35em" :fill="n.color" font-size="15" font-weight="800" font-family="sans-serif">{{ initials(n.c.user.name) }}</text>
          </g>
        </g>
      </g>

      <!-- center: the user (static, on top) -->
      <circle r="34" fill="none" stroke="var(--cd-accent)" stroke-width="2" stroke-opacity="0.5" />
      <circle r="29" fill="var(--cd-accent)" fill-opacity="0.14" stroke="var(--cd-accent)" stroke-width="1.5" />
      <text text-anchor="middle" dy="0.34em" fill="var(--cd-accent)" font-size="18" font-weight="800" font-family="sans-serif">{{ meInitials }}</text>
    </svg>
    <div class="orbit-caption">
      <span class="cd-xpb">LVL {{ me.level }}</span>
      <span>{{ connections.length }} in your orbit</span>
    </div>
  </div>
</template>

<style scoped>
.orbit-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 6px 0 2px;
}
.orbit-svg {
  width: 100%;
  max-width: 340px;
  aspect-ratio: 1;
  overflow: visible;
}
.orbit-node { cursor: pointer; }
.orbit-node:active .orbit-node-inner { opacity: 0.7; }
.orbit-caption {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--cd-dim);
  font-weight: 700;
}
@media (prefers-reduced-motion: no-preference) {
  .orbit-rot {
    transform-box: view-box;
    transform-origin: 50% 50%;
    animation: orbit-spin 80s linear infinite;
  }
  /* Counter-rotate node contents about their own centre so initials stay upright. */
  .orbit-node-inner {
    transform-box: fill-box;
    transform-origin: 50% 50%;
    animation: orbit-spin 80s linear infinite reverse;
  }
}
@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}
</style>
