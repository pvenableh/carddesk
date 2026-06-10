<script setup lang="ts">
/**
 * SortBoard — the gamified networking board. The player drags contact tiles
 * from the "pile" into labelled buckets; every drop is a real pipeline move
 * (the parent maps `@move` → usePipeline().moveToStage). Built for touch with
 * Pointer Events (works for mouse too), big forgiving targets, haptics, and
 * satisfying confetti — tuned for casual players who love a calm sorting game.
 */
import confetti from 'canvas-confetti'

export interface SortItem { id: string; name: string; company?: string; accent?: string }
export interface SortBucket { key: string; label: string; icon: string; accent: string; xp: number; celebrate?: boolean }

const props = defineProps<{ items: SortItem[]; buckets: SortBucket[] }>()
const emit = defineEmits<{ move: [p: { id: string; bucket: string; xp: number }]; cleared: [total: number] }>()

const tray = ref<SortItem[]>([...props.items])
const counts = ref<Record<string, number>>(Object.fromEntries(props.buckets.map((b) => [b.key, 0])))
const totalXp = ref(0)
watch(() => props.items, (v) => { tray.value = [...v]; totalXp.value = 0; for (const k in counts.value) counts.value[k] = 0 })

// ── drag state ──
const dragId = ref<string | null>(null)
const ghost = reactive({ x: 0, y: 0, w: 0, h: 0, name: '', company: '', accent: '' })
const hoverBucket = ref<string | null>(null)
const snapping = ref(false)
const poppingBucket = ref<string | null>(null)
const flyXp = ref<{ id: number; x: number; y: number; amount: number }[]>([])
let offsetX = 0, offsetY = 0
let originRect: DOMRect | null = null
let flyId = 0

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
}

function onPointerDown(e: PointerEvent, item: SortItem) {
  if (dragId.value) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  originRect = r
  offsetX = e.clientX - r.left
  offsetY = e.clientY - r.top
  Object.assign(ghost, { x: r.left, y: r.top, w: r.width, h: r.height, name: item.name, company: item.company ?? '', accent: item.accent ?? 'var(--cd-green)' })
  dragId.value = item.id
  snapping.value = false
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!dragId.value) return
  e.preventDefault()
  ghost.x = e.clientX - offsetX
  ghost.y = e.clientY - offsetY
  const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
  hoverBucket.value = (under?.closest('[data-bucket]') as HTMLElement | null)?.dataset.bucket ?? null
}

function onPointerUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  const id = dragId.value
  const target = hoverBucket.value
  hoverBucket.value = null
  if (id && target) commit(id, target, e.clientX, e.clientY)
  else snapBack()
}

function snapBack() {
  if (!originRect) { dragId.value = null; return }
  snapping.value = true
  ghost.x = originRect.left
  ghost.y = originRect.top
  setTimeout(() => { dragId.value = null; snapping.value = false }, 190)
}

function commit(id: string, bucketKey: string, x: number, y: number) {
  const bucket = props.buckets.find((b) => b.key === bucketKey)
  if (!bucket) { snapBack(); return }
  tray.value = tray.value.filter((i) => i.id !== id)
  counts.value[bucketKey] = (counts.value[bucketKey] ?? 0) + 1
  totalXp.value += bucket.xp
  dragId.value = null

  if (import.meta.client) navigator.vibrate?.(bucket.celebrate ? [18, 28, 40] : 16)

  poppingBucket.value = bucketKey
  setTimeout(() => { if (poppingBucket.value === bucketKey) poppingBucket.value = null }, 340)

  const fid = ++flyId
  flyXp.value.push({ id: fid, x, y, amount: bucket.xp })
  setTimeout(() => { flyXp.value = flyXp.value.filter((f) => f.id !== fid) }, 950)

  if (bucket.celebrate && import.meta.client) {
    confetti({ particleCount: 70, spread: 65, startVelocity: 38, origin: { x: x / window.innerWidth, y: y / window.innerHeight }, colors: ['#ffd700', '#00ff87', '#4da6ff', '#ffffff'] })
  }

  emit('move', { id, bucket: bucketKey, xp: bucket.xp })

  if (!tray.value.length) {
    if (import.meta.client) {
      navigator.vibrate?.([26, 36, 26, 36, 60])
      confetti({ particleCount: 150, spread: 110, startVelocity: 45, origin: { y: 0.55 }, colors: ['#ffd700', '#00ff87', '#4da6ff', '#ff6b35', '#ffffff'] })
    }
    emit('cleared', totalXp.value)
  }
}
</script>

<template>
  <div class="sb">
    <!-- pile of contacts to sort -->
    <div class="sb-pile-wrap">
      <div v-if="!tray.length" class="sb-empty">
        <div class="sb-empty-emoji"><CdIcon :icon="ICON.reward.celebrate" :size="56" /></div>
        <div class="sb-empty-title">Board cleared!</div>
        <div class="sb-empty-sub">+{{ totalXp.toLocaleString() }} XP this round</div>
      </div>
      <TransitionGroup v-else name="sb-tile" tag="div" class="sb-pile">
        <button
          v-for="item in tray"
          :key="item.id"
          class="sb-tile"
          :class="{ lifted: dragId === item.id }"
          :style="{ '--accent': item.accent || 'var(--cd-green)' }"
          @pointerdown="onPointerDown($event, item)"
        >
          <span class="sb-ava">{{ initials(item.name) }}</span>
          <span class="sb-info">
            <span class="sb-name">{{ item.name }}</span>
            <span class="sb-co">{{ item.company }}</span>
          </span>
          <span class="sb-grip"><CdIcon emoji="⠿" icon="lucide:grip-vertical" :size="18" /></span>
        </button>
      </TransitionGroup>
    </div>

    <!-- drop buckets -->
    <div class="sb-bins">
      <div
        v-for="b in buckets"
        :key="b.key"
        class="sb-bin"
        :class="{ hover: hoverBucket === b.key, pop: poppingBucket === b.key }"
        :style="{ '--accent': b.accent }"
        :data-bucket="b.key"
      >
        <div class="sb-bin-emoji" :style="{ color: b.accent }"><CdIcon :icon="b.icon" :size="30" /></div>
        <div class="sb-bin-label">{{ b.label }}</div>
        <div v-if="counts[b.key]" class="sb-bin-count">{{ counts[b.key] }}</div>
      </div>
    </div>

    <!-- floating ghost that follows the finger -->
    <div
      v-if="dragId"
      class="sb-ghost"
      :class="{ snapping }"
      :style="{ left: ghost.x + 'px', top: ghost.y + 'px', width: ghost.w + 'px', height: ghost.h + 'px', '--accent': ghost.accent }"
    >
      <span class="sb-ava">{{ initials(ghost.name) }}</span>
      <span class="sb-info">
        <span class="sb-name">{{ ghost.name }}</span>
        <span class="sb-co">{{ ghost.company }}</span>
      </span>
    </div>

    <!-- flying +XP rewards -->
    <div v-for="f in flyXp" :key="f.id" class="sb-flyxp" :style="{ left: f.x + 'px', top: f.y + 'px' }">+{{ f.amount }} XP</div>
  </div>
</template>

<style scoped>
.sb { display: flex; flex-direction: column; gap: 16px; height: 100%; min-height: 0; }

/* ── pile ── */
.sb-pile-wrap { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.sb-pile { display: flex; flex-direction: column; gap: 10px; }
.sb-tile {
  position: relative;
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 14px 14px 14px 18px; text-align: left;
  /* liquid-glass material — frosted, refracts the ambient aurora behind it */
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 65% / 0.14) 0%,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 45% / 0.05) 50%,
      hsl(var(--glass-h2, 280) var(--glass-s, 60%) 50% / 0.10) 100%),
    rgba(30, 30, 34, 0.50);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  border: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.16);
  border-radius: 16px;
  box-shadow: var(--glass-inset), var(--glass-shadow, 0 12px 30px -18px rgba(0, 0, 0, 0.4));
  cursor: grab;
  touch-action: none;            /* let us own the drag, no page scroll */
  user-select: none; -webkit-user-select: none;
  transition: transform 0.14s ease, opacity 0.14s ease, box-shadow 0.14s ease;
}
/* accent as a crisp straight bar (absolute) — never bends with the radius */
.sb-tile::before, .sb-ghost::before {
  content: '';
  position: absolute; left: 0; top: 14px; bottom: 14px;
  width: 4px; border-radius: 0 4px 4px 0;
  background: var(--accent);
}
.sb-tile:active { cursor: grabbing; }
.sb-tile.lifted { opacity: 0.25; transform: scale(0.97); }
.sb-ava {
  width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 15px; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent);
}
.sb-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.sb-name { font-weight: 800; font-size: 1rem; color: var(--cd-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-co { font-size: 0.82rem; color: var(--cd-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-grip { color: var(--cd-dim); flex-shrink: 0; }

/* ── buckets ── */
.sb-bins { flex-shrink: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sb-bin {
  position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  min-height: 92px; padding: 12px 8px;
  border-radius: 18px;
  /* frosted accent-tinted glass drop zone */
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--accent) 22%, transparent) 0%,
      color-mix(in srgb, var(--accent) 6%, transparent) 70%),
    rgba(30, 30, 34, 0.40);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  border: 2px dashed color-mix(in srgb, var(--accent) 40%, transparent);
  box-shadow: var(--glass-inset);
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}
.sb-bin.hover {
  border-style: solid;
  border-color: var(--accent);
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--accent) 38%, transparent) 0%,
      color-mix(in srgb, var(--accent) 14%, transparent) 70%),
    rgba(30, 30, 34, 0.34);
  transform: scale(1.04);
  box-shadow: var(--glass-inset), 0 16px 38px -14px color-mix(in srgb, var(--accent) 70%, transparent);
}
.sb-bin.pop { animation: sb-pop 0.34s ease; }
@keyframes sb-pop { 0% { transform: scale(1); } 35% { transform: scale(1.12); } 100% { transform: scale(1); } }
.sb-bin-emoji { font-size: 28px; line-height: 1; }
.sb-bin-label { font-size: 0.8rem; font-weight: 800; color: var(--cd-text); text-align: center; }
.sb-bin-count {
  position: absolute; top: 8px; right: 10px;
  min-width: 22px; height: 22px; padding: 0 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.74rem; font-weight: 800; color: #060810;
  background: var(--accent); border-radius: 999px;
}

/* ── floating ghost ── */
.sb-ghost {
  position: fixed; z-index: 1000; pointer-events: none;
  display: flex; align-items: center; gap: 12px; padding: 14px;
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 70% / 0.22) 0%,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 45% / 0.08) 55%,
      hsl(var(--glass-h2, 280) var(--glass-s, 60%) 55% / 0.14) 100%),
    rgba(30, 30, 34, 0.58);
  backdrop-filter: blur(26px) saturate(180%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, hsl(var(--glass-h, 220) 30% 75% / 0.2));
  border-radius: 16px;
  padding-left: 18px;
  box-shadow: var(--glass-inset), 0 26px 54px -16px rgba(0, 0, 0, 0.62);
  transform: scale(1.06) rotate(-2deg);
}
.sb-ghost.snapping { transition: left 0.19s cubic-bezier(0.2, 0.9, 0.3, 1), top 0.19s cubic-bezier(0.2, 0.9, 0.3, 1); }

/* ── flying +XP ── */
.sb-flyxp {
  position: fixed; z-index: 1001; pointer-events: none;
  transform: translate(-50%, -50%);
  font-weight: 900; font-size: 1.1rem; color: var(--cd-gold, #ffd700);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  animation: sb-fly 0.95s ease-out forwards;
}
@keyframes sb-fly {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
  20% { opacity: 1; transform: translate(-50%, -90%) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -210%) scale(1); }
}

/* ── empty / cleared ── */
.sb-empty { height: 100%; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; }
.sb-empty-emoji { color: var(--cd-gold, #ffd700); line-height: 0; animation: sb-bounce 1.4s ease-in-out infinite; }
@keyframes sb-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
.sb-empty-title { font-size: 1.5rem; font-weight: 900; color: var(--cd-text); }
.sb-empty-sub { font-size: 1rem; font-weight: 700; color: var(--cd-green); }

/* tile enter/leave */
.sb-tile-leave-active { transition: all 0.25s ease; position: relative; }
.sb-tile-leave-to { opacity: 0; transform: translateX(40px) scale(0.9); }
.sb-tile-move { transition: transform 0.25s ease; }
</style>
