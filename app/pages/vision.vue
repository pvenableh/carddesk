<script setup lang="ts">
/**
 * "Your Vision" — a personal-advancement surface built as a CLICK concept: it
 * shows who you're becoming (next rank), the path to get there, and your single
 * highest-leverage next move as a one-tap action. Every element advances you —
 * each click adds XP, moves the bar, and (when the path is cleared) ranks you up.
 *
 * Public demo with mock data so it's playable/verifiable without auth. The real
 * in-app version would derive `moves` from overdue follow-ups / pipeline gaps and
 * `journey` from useXp() levels.
 */
import confetti from 'canvas-confetti'

definePageMeta({ layout: false })
useSeoMeta({
  title: 'Your Vision · CardDesk',
  description: 'See your personal-advancement vision in CardDesk — levels, ranks, and the milestones that turn networking into momentum.',
})

const rank = ref({ level: 5, title: 'Connector', next: 'Networker' })
const xp = ref(2480)
const pct = ref(52)            // progress toward the next rank
const rankedUp = ref(false)

interface Move { id: string; icon: string; title: string; sub: string; xp: number; advance: number; accent: string }
const seedMoves: Move[] = [
  { id: 'm1', icon: 'lucide:clock', title: 'Follow up with Maya Chen', sub: '4 days overdue · she opened your last note', xp: 25, advance: 16, accent: 'var(--cd-green)' },
  { id: 'm2', icon: 'lucide:scan-line', title: 'Scan a new card', sub: 'Grow your network — every face counts', xp: 50, advance: 16, accent: 'var(--cd-palette-primary, #4da6ff)' },
  { id: 'm3', icon: 'lucide:flame', title: 'Turn Devin Brooks hot', sub: 'Warm lead, replied twice — make the ask', xp: 50, advance: 18, accent: 'var(--cd-orange, #ff6b35)' },
]
const moves = ref<Move[]>([...seedMoves])

const journey = [
  { title: 'Newcomer', unlock: 'You showed up', state: 'done' },
  { title: 'Connector', unlock: 'Your network has momentum', state: 'current' },
  { title: 'Networker', unlock: 'Unlocks AI intro suggestions', state: 'next' },
  { title: 'Rainmaker', unlock: 'Unlocks deep pipeline insights', state: 'locked' },
  { title: 'Super-Connector', unlock: 'Featured on the leaderboard', state: 'locked' },
]

function act(m: Move, e: MouseEvent) {
  moves.value = moves.value.filter((x) => x.id !== m.id)
  xp.value += m.xp
  pct.value = Math.min(100, pct.value + m.advance)
  if (import.meta.client) {
    navigator.vibrate?.(16)
    const t = e.currentTarget as HTMLElement
    const r = t.getBoundingClientRect()
    confetti({ particleCount: 50, spread: 60, startVelocity: 32, origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }, colors: ['#00ff87', '#ffd700', '#4da6ff', '#ffffff'] })
  }
  if (pct.value >= 100 && !rankedUp.value) {
    rankedUp.value = true
    if (import.meta.client) { navigator.vibrate?.([26, 36, 26, 60]); confetti({ particleCount: 160, spread: 110, startVelocity: 46, origin: { y: 0.55 }, colors: ['#ffd700', '#00ff87', '#4da6ff', '#ff6b35', '#ffffff'] }) }
  }
}
function reset() {
  moves.value = [...seedMoves]
  xp.value = 2480
  pct.value = 52
  rankedUp.value = false
}
</script>

<template>
  <div class="vz">
    <header class="vz-head">
      <div class="vz-eyebrow">Your Vision</div>
      <h1 class="vz-title">You're becoming a <span class="vz-grad">{{ rank.next }}</span></h1>
      <p class="vz-sub">One move at a time. Every click moves you forward.</p>
    </header>

    <!-- identity + progress -->
    <section class="vz-id glass-surface">
      <div class="vz-id-top">
        <div class="vz-badge"><CdIcon icon="lucide:compass" :size="26" /></div>
        <div class="vz-id-info">
          <div class="vz-id-rank">{{ rank.title }} · Level {{ rank.level }}</div>
          <div class="vz-id-xp">{{ xp.toLocaleString() }} XP</div>
        </div>
        <div class="vz-id-next">→ {{ rank.next }}</div>
      </div>
      <div class="vz-bar"><div class="vz-bar-fill" :style="{ width: pct + '%' }" /></div>
      <div class="vz-bar-cap">{{ Math.round(pct) }}% to {{ rank.next }}</div>
    </section>

    <!-- the click concept: next moves -->
    <div class="vz-sec-lbl"><CdIcon icon="lucide:target" :size="13" /> Your next move</div>
    <div v-if="moves.length" class="vz-moves">
      <button
        v-for="m in moves"
        :key="m.id"
        class="vz-move glass-surface"
        :style="{ '--accent': m.accent }"
        @click="act(m, $event)"
      >
        <span class="vz-move-ico"><CdIcon :icon="m.icon" :size="22" /></span>
        <span class="vz-move-copy">
          <span class="vz-move-title">{{ m.title }}</span>
          <span class="vz-move-sub">{{ m.sub }}</span>
        </span>
        <span class="vz-move-xp">+{{ m.xp }}</span>
      </button>
    </div>
    <div v-else class="vz-clear glass-surface">
      <CdIcon icon="lucide:check-check" :size="22" />
      <span>Path cleared for today — you're unstoppable.</span>
    </div>

    <!-- the path -->
    <div class="vz-sec-lbl"><CdIcon icon="lucide:route" :size="13" /> Your path</div>
    <div class="vz-path glass-surface">
      <div v-for="(r, i) in journey" :key="r.title" class="vz-step" :class="r.state">
        <div class="vz-step-dot">
          <CdIcon v-if="r.state === 'done'" icon="lucide:check" :size="13" />
          <CdIcon v-else-if="r.state === 'locked'" icon="lucide:lock" :size="12" />
          <CdIcon v-else icon="lucide:circle-dot" :size="14" />
        </div>
        <div class="vz-step-info">
          <div class="vz-step-title">{{ r.title }}</div>
          <div class="vz-step-unlock">{{ r.unlock }}</div>
        </div>
        <div v-if="i < journey.length - 1" class="vz-step-line" />
      </div>
    </div>

    <button class="vz-reset glass-surface" @click="reset"><CdIcon icon="lucide:rotate-ccw" :size="14" /> Replay demo</button>

    <!-- rank up — native iOS bottom sheet -->
    <Transition name="vz-sheet">
      <div v-if="rankedUp" class="vz-scrim" @click="rankedUp = false">
        <div class="vz-sheet glass-surface" @click.stop>
          <div class="vz-grabber" />
          <div class="vz-rankup-ico"><CdIcon icon="lucide:trophy" :size="54" /></div>
          <div class="vz-rankup-kicker">Rank up!</div>
          <div class="vz-rankup-title">You're now a {{ rank.next }}</div>
          <p class="vz-rankup-sub">AI intro suggestions just unlocked. The next chapter of your network starts now.</p>
          <button class="vz-rankup-btn" @click="rankedUp = false">Keep going</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.vz {
  position: relative;
  min-height: 100vh; min-height: 100dvh;
  max-width: 480px; margin: 0 auto;
  padding: 24px 18px calc(env(safe-area-inset-bottom, 12px) + 24px);
  color: var(--cd-text);
  font-family: 'Proxima Nova', 'Barlow', sans-serif;
}
.vz::before {
  content: ''; position: fixed; inset: 0; z-index: -1;
  background:
    radial-gradient(125% 80% at 0% 0%, hsl(var(--cd-tint-1-h, 220) var(--cd-tint-1-s, 60%) 34% / 0.42) 0%, transparent 55%),
    radial-gradient(120% 85% at 100% 4%, hsl(var(--cd-tint-3-h, 300) var(--cd-tint-3-s, 60%) 36% / 0.34) 0%, transparent 52%),
    radial-gradient(150% 100% at 50% 100%, hsl(var(--cd-tint-4-h, 160) var(--cd-tint-4-s, 55%) 34% / 0.36) 0%, transparent 60%),
    var(--cd-bg);
}

/* shared glass */
.glass-surface {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 65% / 0.14) 0%,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 45% / 0.05) 50%,
      hsl(var(--glass-h2, 280) var(--glass-s, 60%) 50% / 0.10) 100%),
    rgba(30, 30, 34, 0.50);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  border: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.16);
  box-shadow: var(--glass-inset), var(--glass-shadow, 0 12px 30px -18px rgba(0, 0, 0, 0.4));
}

.vz-head { margin-bottom: 16px; }
.vz-eyebrow { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; font-size: 0.8rem; color: var(--cd-muted); margin-bottom: 6px; }
.vz-title { font-family: 'Bebas Neue', sans-serif; font-size: 2.3rem; line-height: 1.02; margin: 0 0 6px; font-weight: 400; }
.vz-grad { background: linear-gradient(100deg, var(--cd-green), var(--cd-palette-primary, #4da6ff) 55%, var(--cd-ice, #a8d8ea)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.vz-sub { font-size: 0.92rem; color: var(--cd-muted); margin: 0; }

.vz-id { border-radius: 20px; padding: 18px; margin: 16px 0 6px; }
.vz-id-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.vz-badge {
  width: 50px; height: 50px; flex-shrink: 0; border-radius: 14px;
  display: flex; align-items: center; justify-content: center; color: var(--cd-green);
  background: color-mix(in srgb, var(--cd-green) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-green) 34%, transparent);
}
.vz-id-info { flex: 1; }
.vz-id-rank { font-weight: 800; font-size: 1.05rem; }
.vz-id-xp { font-size: 0.82rem; color: var(--cd-muted); }
.vz-id-next { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.06em; font-size: 1rem; color: var(--cd-green); }
.vz-bar { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.vz-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--cd-green), var(--cd-palette-primary, #4da6ff)); transition: width 0.5s cubic-bezier(0.2, 0.9, 0.3, 1); }
.vz-bar-cap { font-size: 0.78rem; color: var(--cd-muted); margin-top: 7px; text-align: right; }

.vz-sec-lbl { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800; color: var(--cd-dim); margin: 18px 2px 10px; }

.vz-moves { display: flex; flex-direction: column; gap: 10px; }
.vz-move {
  display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
  padding: 14px; border-radius: 16px; cursor: pointer; color: var(--cd-text);
  transition: transform 0.12s ease, box-shadow 0.16s ease;
}
.vz-move:active { transform: scale(0.99); }
.vz-move-ico {
  width: 46px; height: 46px; flex-shrink: 0; border-radius: 13px;
  display: flex; align-items: center; justify-content: center; color: var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
}
.vz-move-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.vz-move-title { font-weight: 800; font-size: 0.98rem; }
.vz-move-sub { font-size: 0.78rem; color: var(--cd-muted); }
.vz-move-xp { font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem; color: var(--accent); flex-shrink: 0; }

.vz-clear { display: flex; align-items: center; gap: 10px; padding: 16px; border-radius: 16px; color: var(--cd-green); font-weight: 700; font-size: 0.92rem; }

.vz-path { border-radius: 18px; padding: 6px 16px; }
.vz-step { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; }
.vz-step-dot {
  width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; z-index: 1;
  display: flex; align-items: center; justify-content: center;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-dim);
}
.vz-step.done .vz-step-dot { background: color-mix(in srgb, var(--cd-green) 22%, transparent); border-color: var(--cd-green); color: var(--cd-green); }
.vz-step.current .vz-step-dot, .vz-step.next .vz-step-dot { background: color-mix(in srgb, var(--cd-palette-primary, #4da6ff) 22%, transparent); border-color: var(--cd-palette-primary, #4da6ff); color: var(--cd-palette-primary, #4da6ff); }
.vz-step-line { position: absolute; left: 13.5px; top: 30px; bottom: -12px; width: 1px; background: var(--cd-bdr); }
.vz-step-info { flex: 1; }
.vz-step-title { font-weight: 800; font-size: 0.95rem; }
.vz-step.locked .vz-step-title { color: var(--cd-muted); }
.vz-step.current .vz-step-title { color: var(--cd-green); }
.vz-step-unlock { font-size: 0.78rem; color: var(--cd-muted); }

.vz-reset {
  width: 100%; margin-top: 16px; padding: 12px; border-radius: 999px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  color: var(--cd-text); font-weight: 800; font-size: 0.88rem;
}

/* rank up — iOS bottom sheet */
.vz-scrim { position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center; background: rgba(6, 8, 16, 0.55); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.vz-sheet {
  width: 100%; max-width: 480px; text-align: center;
  padding: 12px 24px calc(env(safe-area-inset-bottom, 16px) + 26px);
  border-radius: 28px 28px 0 0;
  border-bottom: none;
}
.vz-grabber { width: 38px; height: 5px; border-radius: 999px; background: rgba(255, 255, 255, 0.28); margin: 0 auto 18px; }
.vz-rankup-ico { color: var(--cd-gold, #ffd700); line-height: 0; margin-bottom: 8px; }
.vz-rankup-kicker { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cd-gold, #ffd700); font-size: 1rem; }
.vz-rankup-title { font-family: 'Bebas Neue', sans-serif; font-size: 2rem; margin: 2px 0 8px; }
.vz-rankup-sub { font-size: 0.9rem; color: var(--cd-muted); line-height: 1.5; margin: 0 auto 20px; max-width: 22em; }
.vz-rankup-btn {
  width: 100%; padding: 15px; border-radius: 999px; border: none; cursor: pointer;
  font-weight: 800; font-size: 0.98rem; color: #060810;
  background: linear-gradient(135deg, var(--cd-green), var(--cd-palette-primary, #4da6ff));
  transition: transform 0.12s cubic-bezier(0.32, 0.72, 0, 1);
}
.vz-rankup-btn:active { transform: scale(0.97); }
/* iOS sheet spring: scrim fades, sheet rides up on the system curve */
.vz-sheet-enter-active, .vz-sheet-leave-active { transition: opacity 0.32s ease; }
.vz-sheet-enter-active .vz-sheet, .vz-sheet-leave-active .vz-sheet { transition: transform 0.44s cubic-bezier(0.32, 0.72, 0, 1); }
.vz-sheet-enter-from, .vz-sheet-leave-to { opacity: 0; }
.vz-sheet-enter-from .vz-sheet, .vz-sheet-leave-to .vz-sheet { transform: translateY(100%); }
</style>
