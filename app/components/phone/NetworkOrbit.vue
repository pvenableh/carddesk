<script setup lang="ts">
import type { NetworkConnection } from '~/composables/useConnections'
import { industryColor } from '~/composables/useConstants'

const props = defineProps<{
  connections: NetworkConnection[]
  me: { name: string; level: number }
  meAvatarUrl?: string | null
}>()

const emit = defineEmits<{ select: [c: NetworkConnection] }>()

// Geometry. Node radius falls off by rank (front = active = large, back = tiny),
// and the viewBox auto-fits, so the whole orbit shrinks as the count grows.
const NODE_MAX = 26      // most-active node radius
const NODE_MIN = 5       // faded background dot radius
const FALLOFF = 0.9      // per-rank size decay (size_i = NODE_MAX * FALLOFF^i)
const LABEL_MIN = 14     // show avatar/initials at/above this radius
const LINE_MIN = 8       // draw a connecting line at/above this radius
const R0 = 92            // innermost ring radius
const RSTEP = 52         // radius added per ring
const RING_BASE = 6      // nodes in ring 0
const RING_GROW = 5      // extra capacity per outer ring (more circumference)
const SPIN_BASE = 54     // seconds per revolution for the innermost ring
const SPIN_STEP = 15     // each outer ring is this much slower (parallax depth)

// Stable 0..1 pseudo-random from a string — used to jitter placement organically.
function rand01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return ((h >>> 0) % 10000) / 10000
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Rank connections by the OTHER user's CardDesk activity blended with how
// recently the connection changed. We have no per-pair interaction log yet, so
// connection recency stands in for "interactions"; XP captures app activity.
const ranked = computed(() => {
  const list = props.connections
  if (!list.length) return []
  const totals = list.map((c) => c.user.totalXp ?? 0)
  const weeks = list.map((c) => c.user.weekXp ?? 0)
  const times = list.map((c) => Date.parse(c.updated || c.since || '') || 0)
  const norm = (v: number, arr: number[]) => {
    const mn = Math.min(...arr), mx = Math.max(...arr)
    return mx > mn ? (v - mn) / (mx - mn) : 0.5
  }
  return list
    .map((c) => {
      const t = Date.parse(c.updated || c.since || '') || 0
      const score =
        0.45 * norm(c.user.totalXp ?? 0, totals) +
        0.30 * norm(c.user.weekXp ?? 0, weeks) +
        0.25 * norm(t, times)
      return { c, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.c)
})

// Which ring a given rank falls in (inner rings fill first → active nearest centre).
function ringOf(rank: number) {
  let ring = 0, start = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cap = RING_BASE + ring * RING_GROW
    if (rank < start + cap) return { ring, pos: rank - start, cap, start }
    start += cap
    ring++
  }
}

const nodes = computed(() => {
  const list = ranked.value
  const N = list.length
  return list.map((c, i) => {
    const { ring, pos, cap, start } = ringOf(i)
    const inRing = Math.min(cap, N - start)
    const seed = c.id || c.user.id || c.user.name
    // Organic jitter so the rings don't read as rigid concentric circles.
    const aJit = (rand01(seed + 'a') - 0.5) * (0.9 / inRing) * Math.PI * 2
    const rJit = (rand01(seed + 'r') - 0.5) * 16
    const r = R0 + ring * RSTEP + rJit
    // Stagger each ring so outer nodes don't sit directly behind inner ones.
    const angle = (pos / inRing) * Math.PI * 2 + ring * 0.6 - Math.PI / 2 + aJit
    const size = Math.max(NODE_MIN, NODE_MAX * Math.pow(FALLOFF, i))
    const opacity = clamp((size - NODE_MIN) / (NODE_MAX - NODE_MIN), 0, 1) * 0.6 + 0.4
    return {
      c, rank: i, ring,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      size,
      opacity,
      labeled: size >= LABEL_MIN,
      hasLine: size >= LINE_MIN,
      // Industry color codes the line + border; otherwise a neutral theme color
      // (adapts to the active light/dark theme) so only industries stand out.
      color: industryColor(c.user.industry) ?? 'var(--cd-muted)',
    }
  })
})

const spinFor = (ring: number) => ({ duration: SPIN_BASE + ring * SPIN_STEP, reverse: ring % 2 === 1 })

// The few large, front nodes each orbit on their OWN layer (with a symmetric
// anchor so the spin pivots on (0,0)) — so hovering one pauses just that single
// connection. They share their ring's speed/direction, so they stay in step.
const soloNodes = computed(() =>
  nodes.value
    .filter((n) => n.labeled)
    .map((n) => ({ ...n, anchor: Math.hypot(n.x, n.y) + n.size, ...spinFor(n.ring) }))
    .sort((a, b) => a.size - b.size),
)

// The tiny background dots stay grouped per ring (one cheap layer each), painted
// outermost-first so the front nodes layer on top. Inner rings spin faster and
// adjacent rings spin opposite ways → a parallax sense of depth.
const dotRings = computed(() => {
  const byRing = new Map<number, typeof nodes.value>()
  for (const n of nodes.value) {
    if (n.labeled) continue
    if (!byRing.has(n.ring)) byRing.set(n.ring, [] as any)
    byRing.get(n.ring)!.push(n)
  }
  return [...byRing.entries()]
    .map(([ring, ns]) => ({
      ring,
      dots: ns,
      lines: ns.filter((n) => n.hasLine),
      anchor: Math.max(R0, ...ns.map((n) => Math.hypot(n.x, n.y) + n.size)),
      ...spinFor(ring),
    }))
    .sort((a, b) => b.ring - a.ring)
})

// Hovering a node pauses just that one connection's orbit.
const hovered = ref<string | null>(null)

// Auto-size the viewBox so every ring (and its node) fits, whatever the count.
const half = computed(() => {
  let m = R0 + 40
  for (const n of nodes.value) m = Math.max(m, Math.hypot(n.x, n.y) + n.size)
  return m + 10
})
const viewBox = computed(() => `${-half.value} ${-half.value} ${half.value * 2} ${half.value * 2}`)
const meInitials = computed(() => initials(props.me.name || 'You'))
</script>

<template>
  <div class="orbit-wrap">
    <svg :viewBox="viewBox" class="orbit-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <!-- objectBoundingBox clip → one circular clip that fits any node/centre size. -->
        <clipPath id="cd-orbit-clip" clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
      </defs>

      <!-- Background dot layers (one per ring), painted outermost-first. -->
      <g
        v-for="r in dotRings"
        :key="'ring' + r.ring"
        class="orbit-ring"
        :style="{ animationDuration: r.duration + 's', animationDirection: r.reverse ? 'reverse' : 'normal' }"
      >
        <circle :r="r.anchor" fill="none" stroke="none" />
        <line
          v-for="n in r.lines"
          :key="'l' + n.c.id"
          x1="0" y1="0" :x2="n.x" :y2="n.y"
          :stroke="n.color" stroke-width="1.5" :stroke-opacity="n.opacity * 0.4"
        />
        <circle
          v-for="n in r.dots"
          :key="n.c.id"
          :cx="n.x" :cy="n.y" :r="n.size"
          class="orbit-node"
          :fill="n.color" :fill-opacity="n.opacity * 0.5"
          :stroke="n.color" stroke-width="1" :stroke-opacity="n.opacity"
          @click="emit('select', n.c)"
        />
      </g>

      <!-- Front nodes: each orbits on its own layer so a single hover pauses it. -->
      <g
        v-for="n in soloNodes"
        :key="n.c.id"
        class="orbit-solo"
        :class="{ paused: hovered === n.c.id }"
        :style="{ animationDuration: n.duration + 's', animationDirection: n.reverse ? 'reverse' : 'normal' }"
      >
        <!-- Symmetric anchor → this node's spin pivots on (0,0). -->
        <circle :r="n.anchor" fill="none" stroke="none" />
        <line x1="0" y1="0" :x2="n.x" :y2="n.y" :stroke="n.color" stroke-width="1.5" :stroke-opacity="n.opacity * 0.45" />
        <g
          :transform="`translate(${n.x} ${n.y})`"
          class="orbit-node"
          @click="emit('select', n.c)"
          @pointerenter="hovered = n.c.id"
          @pointerleave="hovered = null"
        >
          <!-- Counter-rotate contents at this node's exact speed so labels stay upright. -->
          <g class="orbit-node-inner" :style="{ animationDuration: n.duration + 's', animationDirection: n.reverse ? 'normal' : 'reverse' }">
            <!-- Separate scale layer → a springy hover-grow that won't fight the spin. -->
            <g class="orbit-node-grow">
              <circle v-if="!n.c.user.avatarUrl" :r="n.size" :fill="n.color" fill-opacity="0.18" />
              <image
                v-else
                :href="n.c.user.avatarUrl"
                :x="-n.size" :y="-n.size" :width="n.size * 2" :height="n.size * 2"
                clip-path="url(#cd-orbit-clip)" preserveAspectRatio="xMidYMid slice"
              />
              <circle :r="n.size" fill="none" :stroke="n.color" stroke-width="1.5" />
              <text
                v-if="!n.c.user.avatarUrl"
                text-anchor="middle" dy="0.35em" :fill="n.color"
                :font-size="n.size * 0.7" font-weight="800" font-family="sans-serif"
              >{{ initials(n.c.user.name) }}</text>
            </g>
          </g>
        </g>
      </g>

      <!-- center: the user (static, on top) — accent ring + green glow to highlight you. -->
      <g class="orbit-center">
        <circle r="32" fill="var(--cd-bg2)" />
        <!-- Card image → profile avatar (both arrive as meAvatarUrl) → initials. -->
        <template v-if="meAvatarUrl">
          <image
            :href="meAvatarUrl"
            x="-32" y="-32" width="64" height="64"
            clip-path="url(#cd-orbit-clip)" preserveAspectRatio="xMidYMid slice"
          />
        </template>
        <template v-else>
          <circle r="32" fill="var(--center-accent)" fill-opacity="0.14" />
          <text text-anchor="middle" dy="0.34em" fill="var(--center-accent)" font-size="18" font-weight="800" font-family="sans-serif">{{ meInitials }}</text>
        </template>
        <circle r="32" fill="none" stroke="var(--center-accent)" stroke-width="2.5" />
      </g>
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
.orbit-node:active { opacity: 0.7; }
/* Highlight "you" with a glow in the brand chrome accent — the exact green/mint
   used by the "CARD" logo word and the Share Invite button (same fallback chain
   so it tracks every theme/palette). */
.orbit-center {
  --center-accent: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%)));
  filter:
    drop-shadow(0 0 4px var(--center-accent))
    drop-shadow(0 0 11px color-mix(in srgb, var(--center-accent) 60%, transparent));
}
/* Springy hover-grow — a subtle overshoot ("back" easing) that feels native.
   Lives on its own layer so it composes with the spin/counter-rotation. */
.orbit-node-grow {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
}
/* Driven by the same hover state as the pause (not CSS :hover) so the node grows
   and freezes together — and avoids sticky :hover after a tap on touch devices. */
.orbit-solo.paused .orbit-node-grow { transform: scale(1.18); }
/* Background dots scale in place (their position is via cx/cy, not transform). */
circle.orbit-node {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);
}
circle.orbit-node:hover { transform: scale(1.5); }
.orbit-caption {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--cd-dim);
  font-weight: 700;
}
/* Freeze a single connection's orbit (and its upright-keeping counter-rotation)
   while it's hovered. */
.orbit-solo.paused,
.orbit-solo.paused .orbit-node-inner {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: no-preference) {
  /* fill-box + each layer's symmetric anchor → every layer spins around (0,0).
     Duration/direction are set per-layer inline (parallax depth). */
  .orbit-ring,
  .orbit-solo {
    transform-box: fill-box;
    transform-origin: center;
    animation: orbit-spin 60s linear infinite;
  }
  /* Counter-rotate labeled node contents about their own centre so avatars and
     initials stay upright (inline style mirrors the node's speed/direction). */
  .orbit-node-inner {
    transform-box: fill-box;
    transform-origin: center;
    animation: orbit-spin 60s linear infinite reverse;
  }
}
@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}
</style>
