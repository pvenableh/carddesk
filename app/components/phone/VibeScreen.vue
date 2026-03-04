<script setup lang="ts">
import { VIBE_MOODS, getAct, cEmoji } from '~/composables/useConstants'
import { fmtRelative } from '~/composables/useFormatters'
import type { CdActivity, CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince } = useContacts()
const { state: xp, earn, curLevel, nextLevel, xpPct } = useXp()
const { nav } = useNavigation()
const { profile } = useProfile()

const coldCs = computed(() =>
  contacts.value.filter((c) => c.rating === 'cold' && !c.hibernated)
)
const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)

const recentActivity = computed(() => {
  const items: { act: CdActivity; contact: CdContact }[] = []
  for (const c of contacts.value) {
    for (const a of (c.activities as CdActivity[]) ?? []) {
      items.push({ act: a, contact: c })
    }
  }
  return items
    .sort((a, b) => new Date(b.act.date).getTime() - new Date(a.act.date).getTime())
    .slice(0, 5)
})

const moodIdx = ref(0)
const curMood = computed(() => VIBE_MOODS[moodIdx.value % VIBE_MOODS.length])

const sessionMode = ref<'tough' | 'hype' | null>(null)

// Daily hype claim — only once per day
const hypeClaimedDate = ref('')
const hypeClaimed = computed(() => hypeClaimedDate.value === new Date().toISOString().slice(0, 10))
function claimHype() {
  if (hypeClaimed.value) return
  hypeClaimedDate.value = new Date().toISOString().slice(0, 10)
  earn(20, '🏆', 'Daily hype claimed!')
}

// XP chart — 7-day activity breakdown (reactive to contact/activity changes)
const last7Days = computed(() => {
  const days: { label: string; date: string; count: number; xp: number; types: Record<string, number> }[] = []
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000)
    const dateStr = d.toISOString().slice(0, 10)
    days.push({ label: dayNames[d.getDay()], date: dateStr, count: 0, xp: 0, types: {} })
  }
  for (const c of contacts.value) {
    for (const a of (c.activities as CdActivity[]) ?? []) {
      const day = days.find((d) => d.date === a.date)
      if (!day) continue
      day.count++
      day.types[a.type] = (day.types[a.type] || 0) + 1
      // Estimate XP earned
      if (a.type === 'converted_client') day.xp += 200
      else if (a.is_response) day.xp += 100
      else if (c.rating === 'hot') day.xp += 50
      else if (!['contact_added', 'card_scanned'].includes(a.type)) day.xp += 25
      else day.xp += 25
    }
  }
  return days
})

const maxDayCount = computed(() => Math.max(1, ...last7Days.value.map((d) => d.count)))
const weekTotal = computed(() => last7Days.value.reduce((sum, d) => sum + d.count, 0))
const weekXp = computed(() => last7Days.value.reduce((sum, d) => sum + d.xp, 0))

// XP source breakdown (reactive)
const xpSources = computed(() => {
  const sources: { label: string; icon: string; lucide: string; count: number; xp: number; color: string }[] = [
    { label: 'Follow-ups', icon: '✉️', lucide: 'lucide:send', count: 0, xp: 0, color: '#4da6ff' },
    { label: 'Responses', icon: '🎉', lucide: 'lucide:party-popper', count: 0, xp: 0, color: '#00ff87' },
    { label: 'Hot Leads', icon: '🔥', lucide: 'lucide:flame', count: 0, xp: 0, color: '#ff6b35' },
    { label: 'Scans', icon: '📷', lucide: 'lucide:camera', count: 0, xp: 0, color: '#b87dff' },
    { label: 'Clients', icon: '💰', lucide: 'lucide:badge-check', count: 0, xp: 0, color: '#ffd700' },
  ]
  for (const c of contacts.value) {
    for (const a of (c.activities as CdActivity[]) ?? []) {
      if (a.type === 'converted_client') { sources[4].count++; sources[4].xp += 200 }
      else if (a.is_response) { sources[1].count++; sources[1].xp += 100 }
      else if (a.type === 'card_scanned') { sources[3].count++; sources[3].xp += 25 }
      else if (c.rating === 'hot' && !['contact_added'].includes(a.type)) { sources[2].count++; sources[2].xp += 50 }
      else if (!['contact_added'].includes(a.type)) { sources[0].count++; sources[0].xp += 25 }
    }
  }
  return sources.filter((s) => s.count > 0).sort((a, b) => b.xp - a.xp)
})

function goDetail(id: string) {
  const { goDetail: gd } = useNavigation()
  gd(id)
}

// AI lead suggestions
const leadSuggestions = ref<Array<{ icon: string; title: string; body: string }>>([])
const leadSugLoading = ref(false)
const leadSugError = ref<string | null>(null)

async function loadLeadSuggestions() {
  leadSugLoading.value = true; leadSugError.value = null; leadSuggestions.value = []
  try {
    const hot = contacts.value.filter((c) => c.rating === 'hot' && !c.hibernated).length
    const warm = contacts.value.filter((c) => c.rating === 'warm' && !c.hibernated).length
    const cold = contacts.value.filter((c) => c.rating === 'cold' && !c.hibernated).length
    const clients = contacts.value.filter((c) => (c as any).is_client).length
    const overdue = contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue').length

    const recent = recentActivity.value.map((item) => ({
      date: item.act.date,
      type: item.act.type,
      contactName: item.contact.name,
      note: item.act.note,
      isResponse: item.act.is_response,
    }))

    // Build per-contact details so AI can give specific suggestions
    const contactDetails = contacts.value
      .filter((c) => !c.hibernated)
      .slice(0, 20) // limit to 20 most relevant
      .map((c) => {
        const la = ((c.activities as CdActivity[]) ?? [])
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
        return {
          name: c.name,
          company: c.company,
          title: c.title,
          industry: c.industry,
          rating: c.rating,
          isClient: (c as any).is_client,
          daysSince: daysSince(c),
          followUpStatus: followUpStatus(c),
          lastActivityType: la?.type,
          lastActivityNote: la?.note,
          lastActivityWasResponse: la?.is_response,
        }
      })

    const data = await $fetch<Array<{ icon: string; title: string; body: string }>>('/api/ai-lead-suggestions', {
      method: 'POST',
      body: {
        contacts: { total: contacts.value.length, hot, warm, cold, clients, overdue },
        recentActivity: recent,
        contactDetails,
        xp: { level: xp.value.level, levelTitle: curLevel.value.title, totalXp: xp.value.total_xp, streak: xp.value.streak },
      },
    })
    leadSuggestions.value = data
  } catch { leadSugError.value = 'Could not load suggestions' }
  finally { leadSugLoading.value = false }
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr"><div class="cd-stitle">Your Vibe <CdIcon emoji="⚡" icon="lucide:zap" /></div></div>
    <div class="cd-scrl cd-pad">
      <div class="cd-sess-entry" @click="nav('session')">
        <div class="cd-se-top">
          <span style="font-size: 26px"><CdIcon emoji="🎙" icon="lucide:mic" :size="26" /></span>
          <div>
            <div class="cd-se-ttl">Need a session?</div>
            <div class="cd-se-sub">30 seconds. Promise.</div>
          </div>
        </div>
        <div class="cd-se-modes">
          <button class="cd-semp tg" @click.stop="sessionMode = 'tough'; nav('session')">
            <CdIcon emoji="💪" icon="lucide:dumbbell" :size="14" /> Talking to
          </button>
          <button class="cd-semp pk" @click.stop="sessionMode = 'hype'; nav('session')">
            <CdIcon emoji="🏆" icon="lucide:trophy" :size="14" /> Picker upper
          </button>
        </div>
      </div>

      <div class="cd-vc" style="border-color: rgba(0,255,135,0.15); padding-bottom: 6px">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px">
          <div style="position: relative; width: 56px; height: 56px; flex-shrink: 0">
            <svg viewBox="0 0 36 36" style="width: 56px; height: 56px; transform: rotate(-90deg)">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1c2330" stroke-width="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" stroke="#00ff87" stroke-width="3"
                stroke-linecap="round"
                :stroke-dasharray="97.4"
                :stroke-dashoffset="97.4 - (97.4 * xpPct / 100)"
                style="transition: stroke-dashoffset 0.6s ease"
              />
            </svg>
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column">
              <div style="font-family: 'Bebas Neue', sans-serif; font-size: 15px; line-height: 1; color: #00ff87">{{ xp.level }}</div>
              <div style="font-size: 7px; color: #3e4f68; font-weight: 700; text-transform: uppercase">LVL</div>
            </div>
          </div>
          <div style="flex: 1">
            <div style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; line-height: 1; color: #f0f4ff">{{ xp.total_xp.toLocaleString() }} <span style="font-size: 13px; color: #3e4f68">XP</span></div>
            <div v-if="nextLevel" style="font-size: 10px; color: #8898b0; margin-top: 2px">
              {{ (nextLevel.xp - xp.total_xp).toLocaleString() }} XP to {{ nextLevel.title }}
            </div>
            <div style="display: flex; gap: 8px; margin-top: 4px">
              <span style="font-size: 10px; color: #00ff87; font-weight: 700">
                <CdIcon emoji="🔥" icon="lucide:flame" :size="10" /> {{ xp.streak }}d streak
              </span>
              <span style="font-size: 10px; color: #4da6ff; font-weight: 700">
                <CdIcon emoji="📊" icon="lucide:trending-up" :size="10" /> {{ weekXp }} XP this week
              </span>
            </div>
          </div>
        </div>

        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #3e4f68; margin-bottom: 6px">
          <CdIcon emoji="📈" icon="lucide:bar-chart-3" :size="10" /> 7-Day Activity
        </div>
        <div style="display: flex; align-items: flex-end; gap: 4px; height: 60px; margin-bottom: 4px">
          <div
            v-for="day in last7Days"
            :key="day.date"
            style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%"
          >
            <div style="flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center">
              <div
                style="width: 100%; max-width: 20px; border-radius: 4px 4px 0 0; transition: height 0.4s ease; min-height: 2px"
                :style="{
                  height: day.count ? Math.max(12, (day.count / maxDayCount) * 100) + '%' : '4%',
                  background: day.count === 0 ? '#1c2330' : day.count >= 3 ? '#00ff87' : day.count >= 2 ? '#4da6ff' : '#ffe033',
                }"
              >
                <div v-if="day.count" style="text-align: center; font-size: 8px; font-weight: 800; color: #0a0e14; padding-top: 1px">
                  {{ day.count }}
                </div>
              </div>
            </div>
            <div
              style="font-size: 8px; font-weight: 700; margin-top: 3px; text-transform: uppercase"
              :style="day.date === new Date().toISOString().slice(0, 10) ? 'color: #00ff87' : 'color: #3e4f68'"
            >{{ day.label }}</div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 9px; color: #3e4f68; margin-bottom: 8px">
          <span>{{ weekTotal }} touchpoints this week</span>
          <span v-if="weekTotal">avg {{ (weekTotal / 7).toFixed(1) }}/day</span>
        </div>

        <template v-if="xpSources.length">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #3e4f68; margin-bottom: 5px">
            <CdIcon emoji="⚡" icon="lucide:zap" :size="10" /> Points Breakdown
          </div>
          <div v-for="src in xpSources" :key="src.label" style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px">
            <CdIcon :emoji="src.icon" :icon="src.lucide" :size="12" />
            <span style="font-size: 11px; font-weight: 700; width: 72px; flex-shrink: 0">{{ src.label }}</span>
            <div style="flex: 1; height: 4px; background: #1c2330; border-radius: 2px; overflow: hidden">
              <div
                style="height: 100%; border-radius: 2px; transition: width 0.4s ease"
                :style="'width:' + (xpSources[0].xp ? Math.round((src.xp / xpSources[0].xp) * 100) : 0) + '%;background:' + src.color"
              ></div>
            </div>
            <span style="font-size: 10px; font-weight: 700; width: 42px; text-align: right; flex-shrink: 0" :style="'color:' + src.color">
              {{ src.xp }} XP
            </span>
          </div>
        </template>
      </div>

      <div class="cd-vc hype" :style="hypeClaimed ? 'opacity: 0.5; pointer-events: none' : ''" @click="claimHype">
        <div class="cd-vct">
          <span class="cd-vci"><CdIcon :emoji="hypeClaimed ? '✅' : '🏆'" :icon="hypeClaimed ? 'lucide:check-circle' : 'lucide:trophy'" /></span>
          <div>
            <div class="cd-vch" style="color: #00ff87">{{ hypeClaimed ? 'Hype claimed today!' : 'Nobody crushes it like you.' }}</div>
            <div class="cd-vcb">
              {{ contacts.length }} contacts · {{ xp.streak }}-day streak.
              <strong>{{ hypeClaimed ? 'Come back tomorrow for more.' : 'You\'re building something real.' }}</strong>
            </div>
          </div>
          <span class="cd-xpb">{{ hypeClaimed ? '✓ Done' : '+20 XP' }}</span>
        </div>
      </div>

      <div v-if="coldCs.length" class="cd-vc cold-vc" @click="nav('cold')">
        <div class="cd-vct">
          <span class="cd-vci"><CdIcon emoji="❄️" icon="lucide:snowflake" /></span>
          <div>
            <div class="cd-vch" style="color: #a8d8ea">{{ coldCs[0].name }} has gone quiet.</div>
            <div class="cd-vcb">One check-in could be all it takes.</div>
          </div>
        </div>
        <button class="cd-abtn ice" @click.stop="nav('cold')"><CdIcon emoji="🌡" icon="lucide:thermometer" :size="14" /> See cold contacts</button>
      </div>

      <div v-if="alertCs.length" class="cd-vc warn" @click="goDetail(alertCs[0].id)">
        <div class="cd-vct">
          <span class="cd-vci"><CdIcon emoji="⚡" icon="lucide:zap" /></span>
          <div>
            <div class="cd-vch" style="color: #ff6b35">{{ alertCs[0].name }} is slipping away.</div>
            <div class="cd-vcb">{{ daysSince(alertCs[0]) }} days without a follow-up.</div>
          </div>
        </div>
        <button class="cd-abtn o" @click.stop="goDetail(alertCs[0].id)"><CdIcon emoji="⚡" icon="lucide:zap" :size="14" /> Follow up now</button>
      </div>

      <div class="cd-vc" style="border-color: rgba(77, 166, 255, 0.2)">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
          <div style="display: flex; align-items: center; gap: 6px">
            <CdIcon emoji="🤖" icon="lucide:sparkles" :size="15" />
            <span style="font-size: 13px; font-weight: 800; color: #4da6ff">What should I do next?</span>
          </div>
          <button
            class="cd-abtn"
            style="font-size: 10px; padding: 4px 10px; background: transparent; border-color: #1c2330; color: #4da6ff; width: auto; flex-shrink: 0"
            :disabled="leadSugLoading"
            @click="loadLeadSuggestions"
          >
            <CdIcon emoji="✨" icon="lucide:sparkles" :size="10" />
            {{ leadSugLoading ? 'Thinking...' : leadSuggestions.length ? 'Refresh' : 'Get AI Ideas' }}
          </button>
        </div>
        <div v-if="leadSugError" style="font-size: 12px; color: #f87171; margin-bottom: 6px">{{ leadSugError }}</div>
        <div v-if="!leadSuggestions.length && !leadSugLoading && !leadSugError" style="font-size: 11px; color: #3e4f68; line-height: 1.5">
          Tap <strong style="color: #4da6ff">Get AI Ideas</strong> for personalized suggestions on growing your leads.
        </div>
        <div v-if="leadSugLoading" style="text-align: center; padding: 10px 0">
          <div style="font-size: 12px; color: #8898b0; animation: cd-pulse 1.5s ease-in-out infinite">Analyzing your network...</div>
        </div>
        <div
          v-for="(s, i) in leadSuggestions"
          :key="i"
          style="background: #0d1018; border: 1px solid #1c2330; border-radius: 10px; padding: 9px 11px; margin-bottom: 6px"
        >
          <div style="font-size: 13px; font-weight: 700; margin-bottom: 2px">{{ s.icon }} {{ s.title }}</div>
          <div style="font-size: 11px; color: #8898b0; line-height: 1.5">{{ s.body }}</div>
        </div>
      </div>

      <div class="cd-feed">
        <div class="cd-feed-hdr">
          <CdIcon emoji="📡" icon="lucide:activity" :size="13" />
          <span>Recent Activity</span>
        </div>
        <template v-if="recentActivity.length">
          <div
            v-for="(item, i) in recentActivity"
            :key="item.act.id"
            class="cd-feed-row"
            @click="goDetail(item.contact.id)"
          >
            <div class="cd-feed-dot" :class="item.act.type">
              <CdIcon :emoji="getAct(item.act.type).icon" :icon="getAct(item.act.type).lucide" :size="14" />
            </div>
            <div class="cd-feed-body">
              <div class="cd-feed-top">
                <span class="cd-feed-who">{{ item.contact.name }}</span>
                <span class="cd-feed-when">{{ fmtRelative(item.act.date) }}</span>
              </div>
              <div class="cd-feed-what">
                {{ item.act.label }}<template v-if="item.act.note"> — {{ item.act.note }}</template>
              </div>
              <div v-if="item.act.is_response" class="cd-feed-resp">
                <CdIcon emoji="✓" icon="lucide:check" :size="10" /> replied
              </div>
            </div>
          </div>
        </template>
        <div v-else class="cd-feed-empty">
          <div class="cd-feed-empty-msg">No activity yet — get started!</div>
          <div class="cd-feed-actions">
            <button class="cd-feed-action" @click="nav('add')">
              <CdIcon emoji="📷" icon="lucide:scan" :size="14" /> Scan a Card
            </button>
            <button class="cd-feed-action" @click="nav('contacts')">
              <CdIcon emoji="👥" icon="lucide:users" :size="14" /> View Contacts
            </button>
            <button class="cd-feed-action" @click="nav('session')">
              <CdIcon emoji="🎙" icon="lucide:mic" :size="14" /> Start Session
            </button>
          </div>
        </div>
      </div>

      <div class="cd-mood" @click="moodIdx++">
        <div style="font-size: 24px; margin-bottom: 5px"><CdIcon :emoji="curMood.e" :icon="curMood.lucide" :size="24" /></div>
        <div class="cd-mc-t" :class="curMood.color">{{ curMood.title }}</div>
        <div class="cd-mc-b">{{ curMood.body }}</div>
        <div style="font-size: 10px; color: #3e4f68; margin-top: 6px">tap to rotate</div>
      </div>
    </div>
  </div>
</template>
