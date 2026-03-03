<script setup lang="ts">
import { MISSIONS, BADGES } from '~/composables/useConstants'

const { contacts, followUpStatus } = useContacts()
const { state: xp, curLevel, nextLevel, xpPct, earn } = useXp()
const { logout } = useAuth()

const hotCount = computed(() => contacts.value.filter((c) => c.rating === 'hot').length)
const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)

const sDots = computed(() => {
  const dots = []
  for (let i = 0; i < 7; i++) {
    const ago = 6 - i
    if (ago === 0) dots.push(xp.value.streak > 0 ? 'today' : 'empty')
    else dots.push(xp.value.streak > ago ? 'done' : 'empty')
  }
  return dots
})

function doMission(key: string) {
  if (xp.value.completed_missions.includes(key)) return
  xp.value.completed_missions.push(key)
  earn(50, '🎯', 'Mission complete.')
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-scrl cd-pad">
      <div class="cd-hero">
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 11px; letter-spacing: 2px; color: #00ff87; margin-bottom: 2px">
          <CdIcon emoji="🏆" icon="lucide:trophy" :size="11" /> Rockstar Networker
        </div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 40px; line-height: 1">
          {{ curLevel.title }}
        </div>
        <div style="font-size: 11px; color: #8898b0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px">
          Level {{ xp.level }} · {{ xp.total_xp }} XP
        </div>
        <div class="cd-xp-track">
          <div class="cd-xp-fill" :style="'width:' + xpPct + '%'"></div>
        </div>
        <div style="display: flex; gap: 7px; margin-top: 10px">
          <span style="background: rgba(0,255,135,0.1); border: 1px solid rgba(0,255,135,0.25); border-radius: 8px; padding: 4px 11px; font-size: 13px; font-weight: 800; color: #00ff87">
            LVL {{ xp.level }}
          </span>
          <span v-if="nextLevel" style="background: rgba(255,215,0,0.08); border: 1px solid rgba(255,215,0,0.25); border-radius: 8px; padding: 4px 11px; font-size: 13px; font-weight: 800; color: #ffd700">
            {{ nextLevel.xp - xp.total_xp }} XP to {{ nextLevel.title }}
          </span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 11px">
        <div class="cd-stat">
          <div class="cd-stat-n" style="color: #00ff87">{{ contacts.length }}</div>
          <div class="cd-stat-l">Contacts</div>
        </div>
        <div class="cd-stat">
          <div class="cd-stat-n" style="color: #ff6b35"><CdIcon emoji="🔥" icon="lucide:flame" />{{ hotCount }}</div>
          <div class="cd-stat-l">Hot</div>
        </div>
        <div class="cd-stat">
          <div class="cd-stat-n" style="color: #ffe033">{{ alertCs.length }}</div>
          <div class="cd-stat-l">Overdue</div>
        </div>
      </div>

      <div class="cd-streak">
        <div style="font-size: 34px; animation: cd-wig 1.8s ease-in-out infinite; flex-shrink: 0"><CdIcon emoji="🔥" icon="lucide:flame" :size="34" /></div>
        <div style="flex: 1">
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 40px; color: #ff4500; line-height: 1">{{ xp.streak }}</div>
          <div style="font-size: 11px; font-weight: 700; color: #8898b0; text-transform: uppercase">Day Streak</div>
        </div>
        <div style="display: flex; gap: 4px">
          <div v-for="(d, i) in sDots" :key="i" class="cd-sdot" :class="d"></div>
        </div>
      </div>

      <div
        v-for="m in MISSIONS"
        :key="m.key"
        class="cd-mission"
        :class="{ done: xp.completed_missions.includes(m.key) }"
        @click="doMission(m.key)"
      >
        <div class="cd-msn-glow" :class="xp.completed_missions.includes(m.key) ? 'g' : 'o'"></div>
        <span style="font-size: 20px; width: 30px; text-align: center; flex-shrink: 0"><CdIcon :emoji="m.icon" :icon="m.lucide" :size="20" /></span>
        <div style="flex: 1">
          <div style="font-size: 13px; font-weight: 700">{{ m.label }}</div>
          <div style="font-size: 10px; color: #3e4f68; font-style: italic">{{ m.hype }}</div>
        </div>
        <span v-if="!xp.completed_missions.includes(m.key)" class="cd-xpb">+{{ m.xp }} XP</span>
        <span v-else><CdIcon emoji="✅" icon="lucide:check-circle" :size="16" /></span>
      </div>

      <div style="display: flex; gap: 7px; overflow-x: auto; padding: 4px 0 8px; margin-top: 8px">
        <div
          v-for="b in BADGES"
          :key="b.key"
          class="cd-badge"
          :class="{ ul: xp.unlocked_badges.includes(b.key) }"
        >
          <div
            style="font-size: 22px; margin-bottom: 3px"
            :style="xp.unlocked_badges.includes(b.key) ? '' : 'filter:grayscale(1);opacity:0.2'"
          ><CdIcon :emoji="b.emoji" :icon="b.lucide" :size="22" /></div>
          <div
            style="font-size: 9px; text-transform: uppercase; font-weight: 700"
            :style="xp.unlocked_badges.includes(b.key) ? 'color:#ffd700' : 'color:#3e4f68'"
          >{{ b.label }}</div>
        </div>
      </div>

      <button
        class="cd-abtn"
        style="background: transparent; color: #3e4f68; border-color: #1c2330; font-size: 12px; padding: 9px; margin-top: 8px"
        @click="logout"
      >
        Sign Out
      </button>
    </div>
  </div>
</template>
