<script setup lang="ts">
/**
 * SwipeColumn — one swipeable deck for a single mode ("activity" or "people").
 * The parent <SwipeDeck> renders two of these side-by-side on desktop, or one at
 * a time (tabbed) on mobile. Hand-rolled Pointer-Events "cards" swiper: drag the
 * front card, throw past the threshold to advance, spring back otherwise.
 *
 * Cards wear the app's liquid-glass surface via the shared `.cd-swipe-card`
 * class (registered in carddesk.css alongside .cd-vc / .cd-mood).
 */
import type { FeedEvent } from '~/composables/useFeed'
import type { NetworkConnection } from '~/composables/useConnections'
import { fmtRelative } from '~/composables/useFormatters'
import { industryColor } from '~/composables/useConstants'

const props = defineProps<{ mode: 'activity' | 'people' }>()

const { events, loading: feedLoading, load: loadFeed, react } = useFeed()
const { accepted, loading: connLoading, load: loadConns } = useConnections()
const { nav } = useNavigation()
const { show: openShareSheet } = useShareSheet()
// The orbit/connections view lives under the "contacts" screen's network tab.
const netTab = useState<'contacts' | 'connections'>('cd-net-tab', () => 'contacts')
function openOrbit() { netTab.value = 'connections'; nav('contacts') }

const REACTIONS = ['👏', '🔥', '🤝', '🎉', '💡']
const ACT_ICON: Record<string, { emoji: string; icon: string }> = {
  card_scanned: { emoji: '📷', icon: 'lucide:scan-line' },
  level_up: { emoji: '🆙', icon: 'lucide:trending-up' },
  streak: { emoji: '🔥', icon: 'lucide:flame' },
  badge: { emoji: '🏅', icon: 'lucide:award' },
  connected: { emoji: '🤝', icon: 'lucide:users' },
  joined: { emoji: '🎉', icon: 'lucide:party-popper' },
  intro: { emoji: '🌉', icon: 'lucide:git-merge' },
}
function actIcon(type: string) { return ACT_ICON[type] || ACT_ICON.card_scanned }
function actText(e: FeedEvent): string {
  const who = e.mine ? 'You' : e.actor.name
  const p = e.payload || {}
  switch (e.type) {
    case 'card_scanned': return `${who} scanned a card${p.company ? ` from ${p.company}` : ''}`
    case 'level_up': return `${who} reached level ${p.level}`
    case 'streak': return `${who} hit a ${p.days}-day streak`
    case 'badge': return `${who} unlocked the ${String(p.badge || '').replace(/_/g, ' ')} badge`
    case 'connected': return `${who} made a new connection`
    case 'joined': return `${who} joined CardDesk`
    case 'intro': return `${who} made an introduction`
    default: return `${who} was active`
  }
}

const index = ref(0)

// Most-active connections first (lifetime XP, then recency) — mirrors the orbit
// ranking, leading with the relationships worth nurturing.
const people = computed<NetworkConnection[]>(() =>
  [...accepted.value].sort((a, b) =>
    (b.user.totalXp ?? 0) - (a.user.totalXp ?? 0) ||
    new Date(b.updated || b.since).getTime() - new Date(a.updated || a.since).getTime()
  )
)
const items = computed<any[]>(() => (props.mode === 'activity' ? events.value : people.value))
const loading = computed(() => (props.mode === 'activity' ? feedLoading.value : connLoading.value))
const visible = computed(() => items.value.slice(index.value, index.value + 3))
const done = computed(() => !loading.value && index.value >= items.value.length && items.value.length > 0)

onMounted(() => { props.mode === 'activity' ? loadFeed() : loadConns() })
function restart() { index.value = 0 }

// ── Drag / fling physics (per-instance) ────────────────────────────────────
const dx = ref(0)
const dy = ref(0)
const dragging = ref(false)
const flinging = ref(false)
const exiting = ref(false)
const exitDir = ref<1 | -1>(1)
const THRESHOLD = 80
let startX = 0, startY = 0, moved = false

// Drag past the threshold rubber-bands rather than tracking 1:1, so the card
// never slides far enough to reach the neighbouring column.
function damp(x: number) {
  const t = THRESHOLD
  return Math.abs(x) <= t ? x : Math.sign(x) * (t + (Math.abs(x) - t) * 0.45)
}

function onDown(e: PointerEvent) {
  if (flinging.value) return
  startX = e.clientX; startY = e.clientY; moved = false
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function onMove(e: PointerEvent) {
  const ddx = e.clientX - startX, ddy = e.clientY - startY
  if (!moved && Math.hypot(ddx, ddy) < 6) return
  moved = true; dragging.value = true
  dx.value = ddx; dy.value = ddy
}
function onUp() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
  if (!dragging.value) return // it was a tap — let the click through
  dragging.value = false
  if (Math.abs(dx.value) > THRESHOLD) fling(dx.value > 0 ? 1 : -1)
  else { dx.value = 0; dy.value = 0 }
}
function fling(dir: 1 | -1) {
  flinging.value = true
  exitDir.value = dir
  // Swipe-right on an activity card is a quick "hype" — drop a 🔥.
  const front = visible.value[0]
  if (props.mode === 'activity' && dir > 0 && front && !front.myReactions?.includes('🔥')) {
    react(front.id, '🔥')
  }
  // Flip the card edge-on and fade it out in place (it doesn't fly across).
  exiting.value = true
  window.setTimeout(() => {
    index.value++
    dx.value = 0; dy.value = 0
    exiting.value = false
    flinging.value = false
  }, 300)
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
})

// All cards emit the same transform-function list (translate3d/rotate/rotateY/
// scale) so transitions interpolate smoothly — including when a back card is
// promoted to front, or the front card flips out on exit.
function cardStyle(i: number) {
  if (i === 0) {
    if (exiting.value) {
      const d = exitDir.value
      return {
        transform: `translate3d(${d * 30}px, ${dy.value * 0.4}px, 0) rotate(0deg) rotateY(${d * -108}deg) scale(0.86)`,
        opacity: 0,
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.6, 1), opacity 0.3s ease',
        zIndex: 4,
      }
    }
    const x = damp(dx.value)
    return {
      transform: `translate3d(${x}px, ${dy.value}px, 0) rotate(${x / 22}deg) rotateY(0deg) scale(1)`,
      transition: dragging.value ? 'none' : 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      zIndex: 3,
    }
  }
  const lift = Math.min(Math.abs(dx.value) / THRESHOLD, 1)
  return {
    transform: `translate3d(0, ${(i - lift) * 8}px, 0) rotate(0deg) rotateY(0deg) scale(${1 - (i - lift) * 0.045})`,
    transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    zIndex: 3 - i,
    opacity: i >= 2 ? 0.5 : 1,
  }
}

const hint = computed(() => {
  if (!dragging.value || Math.abs(dx.value) < 12) return null
  const right = dx.value > 0
  const op = Math.min(Math.abs(dx.value) / THRESHOLD, 1)
  if (props.mode === 'activity') return { right, op, label: right ? '🔥 Hype' : 'Skip' }
  return { right, op, label: right ? 'Next' : 'Skip' }
})
</script>

<template>
  <div class="cd-deck">
    <!-- Loading -->
    <div v-if="loading && !items.length" class="cd-swipe-card cd-deck-msg">
      <CdIcon icon="lucide:loader" :size="18" class="cd-deck-spin" />
      <span class="cd-deck-msg-b">Loading…</span>
    </div>

    <!-- Empty -->
    <div v-else-if="!items.length" class="cd-swipe-card cd-deck-msg">
      <div class="cd-deck-msg-ico"><CdIcon :icon="mode === 'activity' ? 'lucide:newspaper' : 'lucide:orbit'" :size="22" /></div>
      <div class="cd-deck-msg-t">{{ mode === 'activity' ? 'No activity yet' : 'No connections yet' }}</div>
      <button class="cd-deck-cta" @click="openShareSheet('invite')"><CdIcon icon="lucide:link" :size="12" /> Share invite</button>
    </div>

    <!-- Caught up -->
    <div v-else-if="done" class="cd-swipe-card cd-deck-msg">
      <div class="cd-deck-msg-ico done"><CdIcon icon="lucide:check" :size="22" /></div>
      <div class="cd-deck-msg-t">All caught up</div>
      <button class="cd-deck-cta ghost" @click="restart"><CdIcon icon="lucide:rotate-ccw" :size="12" /> Start over</button>
    </div>

    <!-- The stack -->
    <template v-else>
      <div
        v-for="(it, i) in visible"
        :key="it.id"
        class="cd-swipe-card"
        :class="{ front: i === 0 }"
        :style="cardStyle(i)"
        @pointerdown="i === 0 ? onDown($event) : null"
      >
        <div v-if="i === 0 && hint" class="cd-card-hint" :class="hint.right ? 'right' : 'left'" :style="{ opacity: hint.op }">
          {{ hint.label }}
        </div>

        <!-- Activity card -->
        <template v-if="mode === 'activity'">
          <div class="cd-card-top">
            <div class="cd-card-ic"><CdIcon :emoji="actIcon(it.type).emoji" :icon="actIcon(it.type).icon" :size="16" /></div>
            <div class="cd-card-meta">
              <div class="cd-card-name">{{ it.mine ? 'You' : it.actor.name }}</div>
              <div class="cd-card-sub">{{ fmtRelative(it.date) }}</div>
            </div>
          </div>
          <div class="cd-card-body">{{ actText(it) }}</div>
          <div class="cd-card-reacts">
            <button
              v-for="emoji in REACTIONS"
              :key="emoji"
              class="cd-react"
              :class="{ on: it.myReactions.includes(emoji), reacted: !!it.reactions[emoji] }"
              @click="react(it.id, emoji)"
            ><span class="cd-react-e">{{ emoji }}</span><span v-if="it.reactions[emoji]" class="cd-react-n">{{ it.reactions[emoji] }}</span></button>
          </div>
        </template>

        <!-- People card -->
        <template v-else>
          <div class="cd-card-top">
            <div class="cd-card-av">
              <img v-if="it.user.avatarUrl" :src="it.user.avatarUrl" alt="">
              <CdIcon v-else icon="lucide:user-check" :size="20" />
            </div>
            <div class="cd-card-meta">
              <div class="cd-card-name">{{ it.user.name }}</div>
              <div class="cd-card-sub">{{ it.user.title || 'Connected on CardDesk' }}</div>
            </div>
            <div class="cd-card-lvl">L{{ it.user.level ?? 1 }}</div>
          </div>
          <div class="cd-card-pillrow">
            <span
              v-if="industryColor(it.user.industry)"
              class="cd-card-pill"
              :style="{ color: industryColor(it.user.industry)!, background: industryColor(it.user.industry)! + '22', borderColor: industryColor(it.user.industry)! + '66' }"
            >{{ it.user.industry }}</span>
            <span class="cd-card-pill muted"><CdIcon icon="lucide:link" :size="9" /> {{ fmtRelative(it.updated || it.since) }}</span>
          </div>
          <button class="cd-card-open" @click="openOrbit"><CdIcon icon="lucide:orbit" :size="12" /> View in your orbit</button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cd-deck {
  position: relative;
  height: 152px;
  perspective: 1100px;
}

.cd-swipe-card {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  padding: 12px 13px;
  /* Fallback surface for non-glass themes; the liquid-glass surface is applied
     globally via carddesk.css (see the .cd-swipe-card entry in the glass list). */
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: var(--glass-shadow, 0 18px 40px -22px rgba(0, 0, 0, 0.45));
  will-change: transform;
  user-select: none;
}
.cd-swipe-card.front { cursor: grab; touch-action: pan-y; }
.cd-swipe-card.front:active { cursor: grabbing; }

.cd-card-hint {
  position: absolute; top: 10px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
  padding: 3px 9px; border-radius: 8px; border: 2px solid currentColor; pointer-events: none;
}
.cd-card-hint.right { right: 10px; color: var(--cd-accent); transform: rotate(7deg); }
.cd-card-hint.left { left: 10px; color: #ff6b35; transform: rotate(-7deg); }

.cd-card-top { display: flex; align-items: center; gap: 9px; }
.cd-card-ic, .cd-card-av {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: color-mix(in srgb, var(--cd-accent) 13%, transparent); color: var(--cd-accent);
}
.cd-card-av img { width: 100%; height: 100%; object-fit: cover; }
.cd-card-meta { flex: 1; min-width: 0; }
.cd-card-name { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cd-card-sub { font-size: 10px; color: var(--cd-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cd-card-lvl {
  flex-shrink: 0; font-size: 10px; font-weight: 800; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 13%, transparent); border-radius: 7px; padding: 2px 7px;
}

.cd-card-body {
  flex: 1; display: flex; align-items: center;
  font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--cd-text); margin: 7px 0;
}

.cd-card-reacts { display: flex; gap: 4px; flex-wrap: wrap; }
.cd-react {
  display: inline-flex; align-items: center; gap: 3px; font-size: 13px; line-height: 1;
  padding: 4px 8px; border-radius: 9999px;
  background: color-mix(in srgb, var(--cd-bg) 55%, transparent);
  border: 1px solid var(--cd-bdr); cursor: pointer;
  transition: background 0.18s var(--cd-ease), border-color 0.18s var(--cd-ease), transform 0.18s var(--spring-bounce);
}
.cd-react:active { transform: scale(0.9); }
.cd-react.on { background: color-mix(in srgb, var(--cd-accent) 16%, transparent); border-color: var(--cd-accent); }
.cd-react-e { filter: grayscale(1) opacity(0.45); transition: filter 0.18s var(--cd-ease); }
.cd-react.reacted .cd-react-e { filter: none; }
.cd-react-n { font-size: 10px; font-weight: 700; color: var(--cd-muted); }

.cd-card-pillrow { display: flex; flex-wrap: wrap; gap: 5px; margin: 9px 0; flex: 1; align-content: center; }
.cd-card-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; border: 1px solid var(--cd-bdr);
}
.cd-card-pill.muted { color: var(--cd-dim); background: color-mix(in srgb, var(--cd-bg) 50%, transparent); }
.cd-card-open {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-family: inherit; font-size: 12px; font-weight: 700; color: var(--cd-text);
  background: color-mix(in srgb, var(--cd-bg) 50%, transparent);
  border: 1px solid var(--cd-bdr); border-radius: 10px; padding: 7px; cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.cd-card-open:hover { border-color: var(--cd-accent); color: var(--cd-accent); }

/* Message states (loading / empty / caught-up) reuse the glass card shell. */
.cd-deck-msg {
  align-items: center; justify-content: center; text-align: center; gap: 5px; color: var(--cd-dim);
}
.cd-deck-msg-ico {
  width: 40px; height: 40px; border-radius: 50%; margin-bottom: 2px;
  display: flex; align-items: center; justify-content: center; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 13%, transparent);
}
.cd-deck-msg-ico.done { color: var(--cd-green, #00ff87); }
.cd-deck-msg-t { font-size: 13px; font-weight: 800; color: var(--cd-text); }
.cd-deck-msg-b { font-size: 11px; color: var(--cd-dim); }
.cd-deck-cta {
  margin-top: 6px; display: inline-flex; align-items: center; gap: 6px;
  font-family: inherit; font-size: 11px; font-weight: 700; color: var(--cd-bg, #050710);
  background: var(--cd-accent); border: none; border-radius: 9999px; padding: 6px 13px; cursor: pointer;
}
.cd-deck-cta.ghost { background: transparent; color: var(--cd-dim); border: 1px solid var(--cd-bdr); }
.cd-deck-spin { animation: cd-deck-rot 0.9s linear infinite; }
@keyframes cd-deck-rot { to { transform: rotate(360deg); } }
</style>
