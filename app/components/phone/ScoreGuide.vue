<script setup lang="ts">
import { LEVELS } from '~/composables/useXp'
import { BADGES } from '~/composables/useConstants'

const { open, hide } = useScoreGuide()

// Curated XP table — keep in sync with the values awarded across the app.
const earnGroups: { title: string; items: { icon: string; lucide: string; label: string; xp: string }[] }[] = [
  {
    title: 'Networking',
    items: [
      { icon: '📷', lucide: 'lucide:scan-line', label: 'Scan a business card', xp: '+50' },
      { icon: '💾', lucide: 'lucide:save', label: 'Save a contact', xp: '+25' },
      { icon: '🤝', lucide: 'lucide:user-check', label: 'Accept a connection', xp: '+15' },
      { icon: '🌉', lucide: 'lucide:git-merge', label: 'Introduce two connections', xp: '+50' },
      { icon: '🎉', lucide: 'lucide:party-popper', label: 'Join via an invite', xp: '+25' },
    ],
  },
  {
    title: 'Follow-through',
    items: [
      { icon: '✅', lucide: 'lucide:check-circle', label: 'Log a touchpoint', xp: '+25' },
      { icon: '🎉', lucide: 'lucide:message-circle', label: 'Log a reply from a lead', xp: '+100' },
      { icon: '💎', lucide: 'lucide:gem', label: 'Response from a hot lead', xp: '+50' },
      { icon: '🌅', lucide: 'lucide:sunrise', label: 'Revive a hibernated contact', xp: '+75' },
      { icon: '💰', lucide: 'lucide:badge-check', label: 'Convert a client', xp: '+200' },
    ],
  },
  {
    title: 'Daily games',
    items: [
      { icon: '🧠', lucide: 'lucide:brain', label: 'Network IQ quiz — per correct answer', xp: '+15' },
      { icon: '🏆', lucide: 'lucide:trophy', label: 'Network IQ perfect round bonus', xp: '+25' },
      { icon: '🧩', lucide: 'lucide:puzzle', label: 'Network IQ — just finishing the round', xp: '+5' },
      { icon: '🎰', lucide: 'lucide:dices', label: 'Reconnect Roulette — log the touch it dares you to', xp: '+25/50' },
      { icon: '🧩', lucide: 'lucide:puzzle', label: 'Picture Jam — complete a picture (once a day)', xp: '+10' },
      { icon: '🧩', lucide: 'lucide:puzzle', label: 'Picture Jam — reconnect with who you uncover', xp: '+25/50' },
    ],
  },
  {
    title: 'Bonuses',
    items: [
      { icon: '🏆', lucide: 'lucide:trophy', label: 'Daily hype claim', xp: '+20' },
      { icon: '🔥', lucide: 'lucide:flame', label: '7-day streak bonus', xp: '+200' },
      { icon: '🏅', lucide: 'lucide:award', label: 'Unlock a badge', xp: '+75' },
      { icon: '🎯', lucide: 'lucide:swords', label: 'Daily missions — completed by doing the real action', xp: '+25–100' },
      { icon: '🛡️', lucide: 'lucide:shield', label: 'Streak shield — earned at 7-day streaks & revivals, saves a missed day', xp: 'hold 2' },
    ],
  },
]
</script>

<template>
  <Transition name="cd-flyout">
    <div v-if="open" class="cd-sg-ov" @click.self="hide">
      <div class="cd-sg-panel">
        <div class="cd-sg-hdr">
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px">Scoring Guide</div>
          <button class="cd-sg-x" @click="hide"><CdIcon emoji="×" icon="lucide:x" :size="18" /></button>
        </div>
        <div class="cd-sg-body">
          <p style="font-size: 12px; color: var(--cd-dim); margin: 0 0 14px">Every action earns XP. Stack it to level up, keep streaks alive, and climb your network's leaderboard.</p>

          <template v-for="g in earnGroups" :key="g.title">
            <div class="cd-sg-eyebrow">{{ g.title }}</div>
            <div v-for="it in g.items" :key="it.label" class="cd-sg-row">
              <span class="cd-sg-ic"><CdIcon :emoji="it.icon" :icon="it.lucide" :size="15" /></span>
              <span style="flex: 1; font-size: 13px">{{ it.label }}</span>
              <span class="cd-sg-xp">{{ it.xp }}</span>
            </div>
          </template>

          <div class="cd-sg-eyebrow" style="margin-top: 18px">Levels</div>
          <div class="cd-sg-levels">
            <div v-for="l in LEVELS" :key="l.level" class="cd-sg-lvl">
              <span class="cd-sg-lvln">{{ l.level }}</span>
              <span style="flex: 1; font-size: 13px; font-weight: 700">{{ l.title }}</span>
              <span style="font-size: 11px; color: var(--cd-dim); font-family: monospace">{{ l.xp.toLocaleString() }} XP</span>
            </div>
          </div>

          <div class="cd-sg-eyebrow" style="margin-top: 18px">Badges</div>
          <div v-for="b in BADGES" :key="b.key" class="cd-sg-row">
            <span class="cd-sg-ic"><CdIcon :emoji="b.emoji" :icon="b.lucide" :size="15" /></span>
            <div style="flex: 1; min-width: 0">
              <div style="font-size: 13px; font-weight: 700">{{ b.label }}</div>
              <div style="font-size: 11px; color: var(--cd-dim)">{{ b.desc }}</div>
            </div>
            <span class="cd-sg-xp">+75</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cd-sg-ov {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  justify-content: flex-end;
}
.cd-sg-panel {
  width: min(360px, 90vw);
  height: 100%;
  background: var(--cd-bg);
  border-left: 1px solid var(--cd-bdr);
  display: flex;
  flex-direction: column;
}
.cd-sg-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 8px) + 12px) 18px 12px;
  border-bottom: 1px solid var(--cd-bdr);
  flex-shrink: 0;
}
.cd-sg-x { background: none; border: none; color: var(--cd-dim); cursor: pointer; }
.cd-sg-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px max(24px, env(safe-area-inset-bottom));
}
.cd-sg-eyebrow {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--cd-muted);
  margin-bottom: 8px;
}
.cd-sg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--cd-bdr);
}
.cd-sg-ic {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cd-bg2);
}
.cd-sg-xp {
  font-size: 12px;
  font-weight: 800;
  color: var(--cd-accent);
  font-family: monospace;
  flex-shrink: 0;
}
.cd-sg-levels { margin-bottom: 4px; }
.cd-sg-lvl {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.cd-sg-lvln {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 255, 135, 0.12);
  border: 1px solid var(--cd-accent);
  color: var(--cd-accent);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cd-flyout-enter-active, .cd-flyout-leave-active { transition: opacity 0.2s ease; }
.cd-flyout-enter-active .cd-sg-panel, .cd-flyout-leave-active .cd-sg-panel { transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1); }
.cd-flyout-enter-from, .cd-flyout-leave-to { opacity: 0; }
.cd-flyout-enter-from .cd-sg-panel, .cd-flyout-leave-to .cd-sg-panel { transform: translateX(100%); }
</style>
