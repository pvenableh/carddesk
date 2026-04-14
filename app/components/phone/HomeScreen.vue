<script setup lang="ts">
import { MISSIONS, BADGES, ACT_TYPES, getAct } from '~/composables/useConstants'
import { todayStr } from '~/composables/useFormatters'
import type { CdActivity } from '~/types/directus'

const { contacts, followUpStatus, logActivity } = useContacts()
const { state: xp, curLevel, nextLevel, xpPct, earn } = useXp()
const { logout } = useAuth()
const { getPipelineStats } = usePipeline()

const hotCount = computed(() => contacts.value.filter((c) => c.rating === 'hot').length)
const clientCount = computed(() => contacts.value.filter((c) => (c as any).is_client).length)
const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)

// Industry breakdown
const industryStats = computed(() => {
  const map = new Map<string, { count: number; hot: number; clients: number }>()
  for (const c of contacts.value) {
    if (c.hibernated) continue
    const ind = (c as any).industry || 'Unknown'
    const entry = map.get(ind) || { count: 0, hot: 0, clients: 0 }
    entry.count++
    if (c.rating === 'hot') entry.hot++
    if ((c as any).is_client) entry.clients++
    map.set(ind, entry)
  }
  return [...map.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count)
})

// Channel stats (which communication types get best response)
const channelStats = computed(() => {
  const map = new Map<string, { count: number; responses: number }>()
  for (const c of contacts.value) {
    for (const a of (c.activities as CdActivity[]) ?? []) {
      if (['contact_added', 'card_scanned', 'converted_client'].includes(a.type)) continue
      const entry = map.get(a.type) || { count: 0, responses: 0 }
      entry.count++
      if (a.is_response) entry.responses++
      map.set(a.type, entry)
    }
  }
  return [...map.entries()]
    .map(([type, data]) => ({ type: getAct(type).label, ...data, rate: data.count ? Math.round((data.responses / data.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
})

// Rating distribution
const ratingDist = computed(() => {
  const active = contacts.value.filter((c) => !c.hibernated)
  return {
    hot: active.filter((c) => c.rating === 'hot').length,
    warm: active.filter((c) => c.rating === 'warm').length,
    nurture: active.filter((c) => c.rating === 'nurture').length,
    cold: active.filter((c) => c.rating === 'cold').length,
    unrated: active.filter((c) => !c.rating).length,
  }
})

// Overall response rate
const responseRate = computed(() => {
  let total = 0; let responded = 0
  for (const c of contacts.value) {
    for (const a of (c.activities as CdActivity[]) ?? []) {
      if (['contact_added', 'card_scanned', 'converted_client'].includes(a.type)) continue
      total++
      if (a.is_response) responded++
    }
  }
  return total ? Math.round((responded / total) * 100) : 0
})

// AI Insights
const insights = ref<Array<{ icon: string; title: string; body: string }>>([])
const insightsLoading = ref(false)
const insightsError = ref<string | null>(null)

async function loadInsights() {
  insightsLoading.value = true; insightsError.value = null; insights.value = []
  try {
    const data = await $fetch<Array<{ icon: string; title: string; body: string }>>('/api/ai-insights', {
      method: 'POST',
      body: {
        industries: industryStats.value,
        channels: channelStats.value,
        ratings: ratingDist.value,
        responseRate: responseRate.value,
        contacts: { total: contacts.value.length, clients: clientCount.value },
        xp: { streak: xp.value.streak, level: xp.value.level },
        pipeline: getPipelineStats().stageCounts,
        pipelineValue: getPipelineStats().totalValue,
        stalledCount: getPipelineStats().stalledCount,
      },
    })
    insights.value = data
  } catch { insightsError.value = 'Could not load insights' }
  finally { insightsLoading.value = false }
}

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

// Quick-log event
const logOpen = ref(false)
const logContact = ref('')
const logType = ref('email')
const logNote = ref('')
const logDate = ref(todayStr())
const logSaving = ref(false)

const activeContacts = computed(() =>
  contacts.value.filter((c) => !c.hibernated).sort((a, b) => a.name.localeCompare(b.name))
)

async function doQuickLog() {
  if (!logContact.value || logSaving.value) return
  logSaving.value = true
  try {
    await logActivity({
      contact: logContact.value,
      type: logType.value,
      label: getAct(logType.value).label,
      date: logDate.value || todayStr(),
      note: logNote.value,
      is_response: false,
    })
    earn(25, '✉️', "They'll remember you.")
    logNote.value = ''
    logDate.value = todayStr()
    logContact.value = ''
    logOpen.value = false
  } catch { /* silent */ }
  finally { logSaving.value = false }
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

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 11px">
        <div class="cd-stat">
          <div class="cd-stat-n" style="color: #00ff87">{{ contacts.length }}</div>
          <div class="cd-stat-l">Contacts</div>
        </div>
        <div class="cd-stat">
          <div class="cd-stat-n" style="color: #ff6b35"><CdIcon emoji="🔥" icon="lucide:flame" />{{ hotCount }}</div>
          <div class="cd-stat-l">Hot</div>
        </div>
        <div class="cd-stat">
          <div class="cd-stat-n" style="color: #4da6ff"><CdIcon emoji="💰" icon="lucide:badge-check" />{{ clientCount }}</div>
          <div class="cd-stat-l">Clients</div>
        </div>
        <div class="cd-stat">
          <div class="cd-stat-n" style="color: #ffe033">{{ alertCs.length }}</div>
          <div class="cd-stat-l">Overdue</div>
        </div>
      </div>

      <div v-if="industryStats.length" class="cd-vc" style="border-color: rgba(77, 166, 255, 0.15); margin-bottom: 11px">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #3e4f68; margin-bottom: 8px">
          <CdIcon emoji="🏢" icon="lucide:building-2" :size="12" /> Your Network by Industry
        </div>
        <div v-for="ind in industryStats.slice(0, 5)" :key="ind.name" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
          <div style="flex: 1; min-width: 0">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px">
              <span style="font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ ind.name }}</span>
              <span style="font-size: 11px; color: #8898b0; flex-shrink: 0; margin-left: 6px">{{ ind.count }}</span>
            </div>
            <div style="height: 4px; background: #1c2330; border-radius: 2px; overflow: hidden">
              <div
                style="height: 100%; border-radius: 2px; transition: width 0.3s"
                :style="'width:' + Math.round((ind.count / contacts.length) * 100) + '%;background:' + (ind.hot ? '#ff6b35' : ind.clients ? '#00ff87' : '#4da6ff')"
              ></div>
            </div>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0">
            <span v-if="ind.hot" style="font-size: 9px; background: rgba(255,107,53,0.12); color: #ff6b35; padding: 1px 5px; border-radius: 4px; font-weight: 700">
              <CdIcon emoji="🔥" icon="lucide:flame" :size="8" />{{ ind.hot }}
            </span>
            <span v-if="ind.clients" style="font-size: 9px; background: rgba(0,255,135,0.1); color: #00ff87; padding: 1px 5px; border-radius: 4px; font-weight: 700">
              <CdIcon emoji="💰" icon="lucide:badge-check" :size="8" />{{ ind.clients }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="channelStats.length" class="cd-vc" style="border-color: rgba(255,224,51,0.15); margin-bottom: 11px">
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #3e4f68; margin-bottom: 8px">
          <CdIcon emoji="📊" icon="lucide:bar-chart-3" :size="12" /> Best Channels to Connect
        </div>
        <div v-for="ch in channelStats" :key="ch.type" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
          <span style="font-size: 12px; font-weight: 700; width: 70px; flex-shrink: 0">{{ ch.type }}</span>
          <div style="flex: 1; height: 4px; background: #1c2330; border-radius: 2px; overflow: hidden">
            <div
              style="height: 100%; border-radius: 2px; background: #ffe033; transition: width 0.3s"
              :style="'width:' + (channelStats[0].count ? Math.round((ch.count / channelStats[0].count) * 100) : 0) + '%'"
            ></div>
          </div>
          <span style="font-size: 11px; color: #8898b0; width: 24px; text-align: right; flex-shrink: 0">{{ ch.count }}</span>
          <span
            style="font-size: 9px; padding: 1px 5px; border-radius: 4px; font-weight: 700; width: 36px; text-align: center; flex-shrink: 0"
            :style="ch.rate >= 30 ? 'background:rgba(0,255,135,0.1);color:#00ff87' : ch.rate > 0 ? 'background:rgba(255,224,51,0.1);color:#ffe033' : 'background:rgba(62,79,104,0.2);color:#3e4f68'"
          >{{ ch.rate }}%</span>
        </div>
        <div style="font-size: 10px; color: #3e4f68; margin-top: 4px; text-align: right">
          Overall response rate: <strong :style="responseRate >= 30 ? 'color:#00ff87' : 'color:#ffe033'">{{ responseRate }}%</strong>
        </div>
      </div>

      <div class="cd-vc" style="border-color: rgba(184, 125, 255, 0.2); margin-bottom: 11px">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0">
            <CdIcon emoji="🧠" icon="lucide:brain" :size="15" />
            <span style="font-size: 13px; font-weight: 800; color: #b87dff">Network Insights</span>
          </div>
          <button
            class="cd-abtn"
            style="font-size: 10px; padding: 4px 10px; background: transparent; border-color: #1c2330; color: #b87dff; width: auto; flex-shrink: 0"
            :disabled="insightsLoading"
            @click="loadInsights"
          >
            <CdIcon emoji="✨" icon="lucide:sparkles" :size="10" />
            {{ insightsLoading ? 'Analyzing...' : insights.length ? 'Refresh' : 'Analyze My Network' }}
          </button>
        </div>
        <div v-if="insightsError" style="font-size: 12px; color: #f87171; margin-bottom: 6px">{{ insightsError }}</div>
        <div v-if="!insights.length && !insightsLoading && !insightsError" style="font-size: 11px; color: #3e4f68; line-height: 1.5">
          Tap <strong style="color: #b87dff">Analyze My Network</strong> for AI-powered insights on your industries, channels, and connection strategies.
        </div>
        <div v-if="insightsLoading" style="text-align: center; padding: 10px 0">
          <div style="font-size: 12px; color: #8898b0; animation: cd-pulse 1.5s ease-in-out infinite">Crunching your network data...</div>
        </div>
        <div
          v-for="(s, i) in insights"
          :key="i"
          style="background: #0d1018; border: 1px solid #1c2330; border-radius: 10px; padding: 9px 11px; margin-bottom: 6px"
        >
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 2px">{{ s.icon }} {{ s.title }}</div>
          <div style="font-size: 11px; color: #8898b0; line-height: 1.5">{{ s.body }}</div>
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

      <div class="cd-vc" style="border-color: rgba(0,255,135,0.15); margin-bottom: 11px">
        <div
          style="display: flex; align-items: center; justify-content: space-between; cursor: pointer"
          @click="logOpen = !logOpen"
        >
          <div style="display: flex; align-items: center; gap: 7px">
            <CdIcon emoji="📝" icon="lucide:pencil-line" :size="16" />
            <span style="font-size: 13px; font-weight: 800">Quick Log Event</span>
          </div>
          <span style="font-size: 11px; color: #3e4f68">{{ logOpen ? '▲' : '▼' }}</span>
        </div>
        <template v-if="logOpen">
          <div style="margin-top: 10px">
            <label style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #3e4f68; letter-spacing: 0.5px; display: block; margin-bottom: 4px">Contact</label>
            <select v-model="logContact" class="cd-inp" style="margin-bottom: 8px">
              <option value="" disabled>Select a contact...</option>
              <option v-for="c in activeContacts" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
            <label style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #3e4f68; letter-spacing: 0.5px; display: block; margin-bottom: 4px">Type</label>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px">
              <button
                v-for="t in ACT_TYPES.slice(0, 6)"
                :key="t.key"
                class="cd-act-type"
                :class="{ sel: logType === t.key }"
                @click="logType = t.key"
              >
                <span style="font-size: 13px; display: block; margin-bottom: 1px"><CdIcon :emoji="t.icon" :icon="t.lucide" :size="13" /></span>{{ t.label }}
              </button>
            </div>
            <label style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #3e4f68; letter-spacing: 0.5px; display: block; margin-bottom: 4px">Details</label>
            <textarea v-model="logNote" class="cd-inp" placeholder="What happened? Add details..." style="min-height: 50px; resize: vertical; margin-bottom: 8px"></textarea>
            <div style="display: flex; gap: 6px">
              <input v-model="logDate" type="date" class="cd-inp" style="flex: 0 0 130px; margin-bottom: 0" />
              <button
                class="cd-abtn g"
                style="flex: 1; font-size: 12px; padding: 9px 6px"
                :disabled="!logContact || logSaving"
                @click="doQuickLog"
              >
                <CdIcon emoji="✅" icon="lucide:check-circle" :size="12" /> {{ logSaving ? 'Saving...' : 'Log +25 XP' }}
              </button>
            </div>
          </div>
        </template>
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
