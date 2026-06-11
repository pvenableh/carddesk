<script setup lang="ts">
/**
 * Public demo of the gamified networking SortBoard (no auth — see app/middleware
 * /auth.ts is opt-in, this page doesn't use it). Feeds mock contacts so the drag
 * mechanics can be played/verified without a session. The real in-app screen
 * wires the same <GameSortBoard> to usePipeline().moveToStage instead.
 */
import type { SortItem, SortBucket } from '~/components/game/SortBoard.vue'

definePageMeta({ layout: false })
useSeoMeta({
  title: 'Play the Network Sort Game · CardDesk',
  description: 'Try CardDesk’s network sort-board game — drag contacts into the right buckets and see how gamified networking feels. No signup required.',
})

const buckets: SortBucket[] = [
  { key: 'contacted', label: 'Reached out', icon: ICON.stage.contacted, accent: 'var(--cd-palette-primary, #4da6ff)', xp: 10 },
  { key: 'qualified', label: 'Warming up', icon: ICON.stage.qualified, accent: 'var(--cd-green)', xp: 15 },
  { key: 'won', label: 'Win it!', icon: ICON.stage.won, accent: 'var(--cd-gold, #ffd700)', xp: 150, celebrate: true },
  { key: 'lost', label: 'Not now', icon: ICON.contact.snooze, accent: 'var(--cd-ice, #a8d8ea)', xp: 10 },
]

const seed: SortItem[] = [
  { id: '1', name: 'Maya Chen', company: 'Lumen', accent: 'var(--cd-green)' },
  { id: '2', name: 'Alex Rivera', company: 'Northwind Co', accent: 'var(--cd-palette-primary, #4da6ff)' },
  { id: '3', name: 'Devin Brooks', company: 'Foundry Studio', accent: 'var(--cd-gold, #ffd700)' },
  { id: '4', name: 'Emily Carter', company: 'Beacon', accent: 'var(--cd-orange, #ff6b35)' },
  { id: '5', name: 'Sam Tran', company: 'Vellum', accent: 'var(--cd-ice, #a8d8ea)' },
  { id: '6', name: 'Jordan Lee', company: 'Cobalt Labs', accent: 'var(--cd-green)' },
]
const items = ref<SortItem[]>([...seed])

const log = ref<string[]>([])
const earned = ref(0)
function onMove(p: { id: string; bucket: string; xp: number }) {
  const name = seed.find((i) => i.id === p.id)?.name ?? p.id
  const label = buckets.find((b) => b.key === p.bucket)?.label ?? p.bucket
  earned.value += p.xp
  log.value.unshift(`${name} → ${label}  (+${p.xp} XP)`)
}
function reset() {
  items.value = [...seed]
  log.value = []
  earned.value = 0
}
</script>

<template>
  <div class="play">
    <header class="play-head">
      <div class="play-eyebrow">Networking, but make it a game</div>
      <h1 class="play-title">Sort your network</h1>
      <p class="play-sub">Drag each contact into a bucket — every move updates your pipeline.</p>
      <div class="play-xp"><CdIcon :icon="ICON.reward.xp" :size="16" /> {{ earned.toLocaleString() }} XP</div>
    </header>

    <div class="play-board">
      <GameSortBoard :items="items" :buckets="buckets" @move="onMove" @cleared="() => {}" />
    </div>

    <div class="play-foot">
      <button class="play-reset" @click="reset"><CdIcon :icon="ICON.action.reset" :size="15" /> Deal again</button>
      <div v-if="log.length" class="play-log">
        <div v-for="(l, i) in log" :key="i" class="play-log-row">{{ l }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play {
  position: relative;
  min-height: 100vh; min-height: 100dvh;
  max-width: 480px; margin: 0 auto;
  display: flex; flex-direction: column;
  padding: 24px 18px calc(env(safe-area-inset-bottom, 12px) + 18px);
  color: var(--cd-text);
  font-family: 'Proxima Nova', 'Barlow', sans-serif;
}
/* ambient aurora — full-bleed, fixed, behind everything so the glass refracts it */
.play::before {
  content: '';
  position: fixed; inset: 0; z-index: -1;
  background:
    radial-gradient(125% 80% at 0% 0%, hsl(var(--cd-tint-1-h, 220) var(--cd-tint-1-s, 60%) 34% / 0.42) 0%, transparent 55%),
    radial-gradient(120% 85% at 100% 4%, hsl(var(--cd-tint-3-h, 300) var(--cd-tint-3-s, 60%) 36% / 0.34) 0%, transparent 52%),
    radial-gradient(150% 100% at 50% 100%, hsl(var(--cd-tint-4-h, 160) var(--cd-tint-4-s, 55%) 34% / 0.36) 0%, transparent 60%),
    var(--cd-bg);
}
.play-head { flex-shrink: 0; margin-bottom: 16px; }
.play-eyebrow {
  font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.16em; text-transform: uppercase;
  font-size: 0.8rem; color: var(--cd-muted); margin-bottom: 6px;
}
.play-title { font-family: 'Bebas Neue', sans-serif; font-size: 2.4rem; line-height: 1; margin: 0 0 6px; font-weight: 400; }
.play-sub { font-size: 0.95rem; color: var(--cd-muted); margin: 0 0 12px; }
.play-xp {
  display: inline-flex; align-items: center; gap: 6px;
  font-weight: 800; font-size: 0.95rem; color: var(--cd-gold, #ffd700);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--cd-gold, #ffd700) 22%, transparent), color-mix(in srgb, var(--cd-gold, #ffd700) 8%, transparent)),
    rgba(30, 30, 34, 0.36);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  border: 1px solid color-mix(in srgb, var(--cd-gold, #ffd700) 38%, transparent);
  box-shadow: var(--glass-inset);
  padding: 6px 14px; border-radius: 999px;
}
.play-board { flex: 1; min-height: 0; display: flex; }
.play-board > * { flex: 1; min-height: 0; }
.play-foot { flex-shrink: 0; margin-top: 14px; }
.play-reset {
  width: 100%; padding: 13px; border-radius: 999px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  background:
    linear-gradient(135deg, hsl(var(--glass-h, 220) var(--glass-s, 60%) 65% / 0.14), hsl(var(--glass-h2, 280) var(--glass-s, 60%) 50% / 0.08)),
    rgba(30, 30, 34, 0.40);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  border: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.18); color: var(--cd-text);
  box-shadow: var(--glass-inset), var(--glass-shadow, 0 12px 30px -18px rgba(0,0,0,0.4));
  font-weight: 800; font-size: 0.9rem;
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.12s ease;
}
.play-reset:hover { border-color: var(--cd-accent); color: var(--cd-accent); }
.play-reset:active { transform: scale(0.99); }
.play-log { margin-top: 12px; display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; }
.play-log-row { font-size: 0.8rem; color: var(--cd-muted); font-variant-numeric: tabular-nums; }
</style>
