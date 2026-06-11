<script setup lang="ts">
import { MISSIONS } from '~/composables/useConstants'
import type { Screen } from '~/composables/useNavigation'
import type { CdActivity, CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince } = useContacts()
const { state: xp, earn, curLevel, nextLevel, xpPct } = useXp()
const { nav } = useNavigation()
const { show: openShareSheet } = useShareSheet()
const { show: openScoreGuide } = useScoreGuide()
const { profile } = useProfile()
const { getPipelineStats } = usePipeline()
const eventMode = useEventMode()

const pipelineStats = computed(() => getPipelineStats())

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

const { ask: askEarnest } = useAskEarnest()

const sessionMode = ref<'tough' | 'hype' | null>(null)

// Daily hype claim — once per day, and only AFTER the user has done one real
// networking action that day (so the +20 XP is earned, not handed out). State
// is persisted on cd_xp_state (hype_date) so it can't be farmed by reloading.
const today = new Date().toISOString().slice(0, 10)
const hypeClaimed = computed(() => xp.value.hype_date === today)
const didActionToday = computed(() => xp.value.last_activity_date === today)
function claimHype() {
  if (hypeClaimed.value || !didActionToday.value) return
  earn(20, '🏆', 'Daily hype claimed!', { hype_date: today })
}

// Weekly rhythm — week_xp is tracked authoritatively on the XP state (resets
// every Monday in useXp.earn), so the hero's goal bar can't drift from reality.
const WEEK_GOAL = 500
const weekXp = computed(() => xp.value.week_xp ?? 0)
const weekPct = computed(() => Math.min(100, Math.round((weekXp.value / WEEK_GOAL) * 100)))
const weekTotal = computed(() => {
  const cutoff = Date.now() - 7 * 86_400_000
  let n = 0
  for (const c of contacts.value) {
    for (const a of (c.activities as CdActivity[]) ?? []) {
      if (new Date(a.date).getTime() >= cutoff) n++
    }
  }
  return n
})

// Today's missions — verified, not self-reported (they complete from the real
// actions via useXp.completeMission). Tapping one jumps to where it's done.
const MISSION_GO: Record<string, Screen> = {
  scan: 'add', followup: 'contacts', hot: 'contacts',
  response: 'contacts', ai_session: 'session', ai_ideas: 'contacts',
}
const missionsToday = computed(() =>
  MISSIONS.map((m) => ({
    ...m,
    done: xp.value.missions_date === today && xp.value.completed_missions.includes(m.key),
  }))
)
const missionsDone = computed(() => missionsToday.value.filter((m) => m.done).length)

function goDetail(id: string) {
  const { goDetail: gd } = useNavigation()
  gd(id)
}

function getContact(id?: string) {
  if (!id) return null
  return contacts.value.find((c) => c.id === id) ?? null
}

function doSugAction(s: { contactId?: string; action?: string }) {
  const c = getContact(s.contactId)
  if (!c) return
  if (s.action === 'call' && c.phone) window.open(`tel:${c.phone}`)
  else if (s.action === 'text' && c.phone) window.open(`sms:${c.phone}`)
  else if (s.action === 'email' && c.email) window.open(`mailto:${c.email}`)
  else goDetail(c.id)
}

const SUG_ACTIONS: Record<string, { label: string; icon: string; lucide: string; color: string }> = {
  call: { label: 'Call', icon: '📞', lucide: 'lucide:phone', color: '#00ff87' },
  text: { label: 'Text', icon: '📱', lucide: 'lucide:message-circle', color: '#4da6ff' },
  email: { label: 'Email', icon: '📧', lucide: 'lucide:mail', color: '#b87dff' },
  view: { label: 'View', icon: '👤', lucide: 'lucide:user', color: 'var(--cd-muted)' },
}

// AI lead suggestions
const leadSuggestions = ref<Array<{ icon: string; title: string; body: string; contactId?: string; action?: string }>>([])
const leadSugLoading = ref(false)
const leadSugError = ref<string | null>(null)

const analytics = useAnalytics()
async function loadLeadSuggestions() {
  leadSugLoading.value = true; leadSugError.value = null; leadSuggestions.value = []
  analytics.aiFeatureUse('lead_suggestions')
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
          id: c.id,
          name: c.name,
          company: c.company,
          title: c.title,
          industry: c.industry,
          location: (c as any).location,
          rating: c.rating,
          isClient: (c as any).is_client,
          hasPhone: !!c.phone,
          hasEmail: !!c.email,
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
        contacts: { total: contacts.value.length, hot, warm, cold, clients, overdue, pipeline: pipelineStats.value.stageCounts },
        recentActivity: recent,
        contactDetails: contactDetails.map((c: any) => ({
          ...c,
          pipelineStage: contacts.value.find((ct) => ct.id === c.id)?.pipeline_stage,
          estimatedValue: contacts.value.find((ct) => ct.id === c.id)?.estimated_value,
        })),
        xp: { level: xp.value.level, levelTitle: curLevel.value.title, totalXp: xp.value.total_xp, streak: xp.value.streak },
      },
    })
    leadSuggestions.value = data
  } catch { leadSugError.value = 'Could not load suggestions' }
  finally { leadSugLoading.value = false }
}

// Earnest AI "Daily Vibe" — a warm, personalized pep-talk that replaces the old
// hardcoded mood rotator. It reads the user's real momentum and returns one
// emotional nudge (distinct from the tactical "What should I do next?" widget).
// Generated on demand and cached per-day in localStorage so revisiting the Vibe
// screen doesn't re-spend AI credits.
type DailyVibe = { mood: string; emoji: string; title: string; body: string; cta?: string }
const vibe = ref<DailyVibe | null>(null)
const vibeLoading = ref(false)
const vibeError = ref<string | null>(null)
const VIBE_CACHE_KEY = 'cd-daily-vibe'

onMounted(() => {
  try {
    const cached = JSON.parse(localStorage.getItem(VIBE_CACHE_KEY) || 'null')
    if (cached?.date === today && cached.vibe) vibe.value = cached.vibe
  } catch { /* ignore bad cache */ }
})

async function loadVibe() {
  if (vibeLoading.value) return
  vibeLoading.value = true; vibeError.value = null
  analytics.aiFeatureUse('daily_vibe')
  try {
    const hot = contacts.value.filter((c) => c.rating === 'hot' && !c.hibernated).length
    const warm = contacts.value.filter((c) => c.rating === 'warm' && !c.hibernated).length
    const data = await $fetch<DailyVibe>('/api/ai-daily-vibe', {
      method: 'POST',
      body: {
        stats: {
          streak: xp.value.streak,
          level: xp.value.level,
          levelTitle: curLevel.value.title,
          totalXp: xp.value.total_xp,
          weekXp: weekXp.value,
          weekTouchpoints: weekTotal.value,
          hot, warm, cold: coldCs.value.length, overdue: alertCs.value.length,
          total: contacts.value.length,
          actedToday: didActionToday.value,
        },
        recentActivity: recentActivity.value.map((item) => ({
          type: item.act.type,
          contactName: item.contact.name,
          isResponse: item.act.is_response,
        })),
      },
    })
    vibe.value = data
    try { localStorage.setItem(VIBE_CACHE_KEY, JSON.stringify({ date: today, vibe: data })) } catch { /* quota */ }
  } catch { vibeError.value = 'Could not tune into your vibe' }
  finally { vibeLoading.value = false }
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr"><div class="cd-stitle">Your Vibe <CdIcon emoji="⚡" icon="lucide:zap" /></div></div>
    <div class="cd-scrl cd-pad">
      <div class="cd-foot-fill">
      <!-- Next-best-action queue: overdue follow-ups + a revival candidate.
           First thing you see — the follow-up half of the loop. -->
      <PhoneUpNext />
      <!-- XP hero — level, streak, shields, and the weekly goal in one glance -->
      <div class="cd-vc vb-hero">
        <button aria-label="Scoring guide" class="vb-help" @click.stop="openScoreGuide">
          <CdIcon emoji="?" icon="lucide:help-circle" :size="13" />
        </button>
        <div class="vb-hero-top">
          <div style="position: relative; width: 56px; height: 56px; flex-shrink: 0">
            <svg viewBox="0 0 36 36" style="width: 56px; height: 56px; transform: rotate(-90deg)">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--cd-bdr)" stroke-width="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" stroke-width="3"
                stroke-linecap="round"
                :stroke-dasharray="97.4"
                :stroke-dashoffset="97.4 - (97.4 * xpPct / 100)"
                style="stroke: var(--cd-green); transition: stroke-dashoffset 0.6s ease"
              />
            </svg>
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column">
              <div style="font-family: 'Bebas Neue', sans-serif; font-size: 15px; line-height: 1; color: var(--cd-green)">{{ xp.level }}</div>
              <div style="font-size: 7px; color: var(--cd-dim); font-weight: 700; text-transform: uppercase">LVL</div>
            </div>
          </div>
          <div style="flex: 1">
            <div style="font-family: 'Bebas Neue', sans-serif; font-size: 28px; line-height: 1; color: var(--cd-text)">{{ xp.total_xp.toLocaleString() }} <span style="font-size: 13px; color: var(--cd-dim)">XP</span></div>
            <div v-if="nextLevel" style="font-size: 10px; color: var(--cd-muted); margin-top: 2px">
              {{ (nextLevel.xp - xp.total_xp).toLocaleString() }} XP to {{ nextLevel.title }}
            </div>
            <div class="vb-chips">
              <span class="vb-chip streak"><CdIcon emoji="🔥" icon="lucide:flame" :size="10" /> {{ xp.streak }}d streak</span>
              <span v-if="xp.streak_shields" class="vb-chip shield"><CdIcon emoji="🛡️" icon="lucide:shield" :size="10" /> ×{{ xp.streak_shields }}</span>
              <span class="vb-chip week"><CdIcon emoji="📊" icon="lucide:trending-up" :size="10" /> {{ weekTotal }} touch{{ weekTotal === 1 ? '' : 'es' }} this wk</span>
            </div>
          </div>
        </div>

        <!-- Weekly XP goal — a finish line, not a chart -->
        <div class="vb-goal">
          <div class="vb-goal-lbl">
            <span><CdIcon emoji="🎯" icon="lucide:target" :size="10" /> Weekly goal</span>
            <span :class="{ hit: weekPct >= 100 }">{{ weekXp.toLocaleString() }} / {{ WEEK_GOAL }} XP</span>
          </div>
          <div class="vb-goal-bar">
            <div class="vb-goal-fill" :class="{ hit: weekPct >= 100 }" :style="{ width: weekPct + '%' }"></div>
          </div>
          <div v-if="weekPct >= 100" class="vb-goal-done">
            <CdIcon emoji="🏁" icon="lucide:flag" :size="10" /> Goal smashed — everything else is victory laps
          </div>
        </div>

        <!-- Daily hype claim — unlocked by doing one real action that day -->
        <div v-if="hypeClaimed" style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 11px; color: var(--cd-dim); font-weight: 700">
          <CdIcon emoji="✅" icon="lucide:check-circle" :size="12" /> Daily hype claimed — back tomorrow
        </div>
        <button
          v-else-if="didActionToday"
          class="cd-abtn g"
          style="font-size: 12px; padding: 9px"
          @click="claimHype"
        ><CdIcon emoji="🏆" icon="lucide:trophy" :size="13" /> Claim daily hype · +20 XP</button>
        <div
          v-else
          style="display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px; border: 1px dashed var(--cd-bdr); border-radius: 9999px; font-size: 11px; color: var(--cd-dim); font-weight: 700"
        >
          <CdIcon emoji="🔒" icon="lucide:lock" :size="12" /> Do one action today to unlock <span style="color: var(--cd-green)">+20 XP</span>
        </div>
      </div>

      <!-- On deck — real follow-up tasks due today / overdue (hidden when empty) -->
      <PhoneVibeOnDeck />

      <!-- Today's missions — verified quests; tap one to go do it -->
      <div class="cd-vc vb-missions">
        <div class="vb-m-hdr">
          <CdIcon emoji="🎯" icon="lucide:swords" :size="12" />
          <span>Today's missions</span>
          <span class="vb-m-count">{{ missionsDone }}/{{ missionsToday.length }}</span>
        </div>
        <div class="vb-m-strip">
          <button
            v-for="m in missionsToday" :key="m.key"
            class="vb-m-chip" :class="{ done: m.done }" type="button"
            :disabled="m.done"
            @click="nav(MISSION_GO[m.key] ?? 'home')"
          >
            <CdIcon :emoji="m.done ? '✅' : m.icon" :icon="m.done ? 'lucide:check-circle' : m.lucide" :size="14" />
            <span class="vb-m-lbl">{{ m.label }}</span>
            <span class="vb-m-xp">{{ m.done ? 'done' : `+${m.xp}` }}</span>
          </button>
        </div>
      </div>

      <!-- Network IQ — daily quiz built from your own contacts -->
      <PhoneNetworkQuiz />

      <!-- Reconnect Roulette — spin up a quiet contact, reach out, bank XP -->
      <PhoneReconnectRoulette />

      <!-- Event Mode: focused capture for networking events -->
      <button
        class="cd-abtn g"
        style="width: 100%; display: flex; align-items: center; gap: 8px; justify-content: center; font-size: 14px; padding: 12px; margin-bottom: 8px"
        @click="eventMode.openPanel()"
      >
        <CdIcon icon="lucide:radio" :size="16" />
        <span>{{ eventMode.active.value ? `Event Mode · ${eventMode.count.value} met` : 'Event Mode' }}</span>
        <CdIcon icon="lucide:arrow-right" :size="14" />
      </button>
      <!-- Grow your network: share your card or invite -->
      <div style="display: flex; gap: 8px; margin-bottom: 12px">
        <button class="cd-abtn ice" style="font-size: 12px; padding: 10px" @click="openShareSheet('card')"><CdCardMark :size="15" :gradient="false" /> My Card</button>
        <button class="cd-abtn b" style="font-size: 12px; padding: 10px" @click="openShareSheet('invite')"><CdIcon emoji="🔗" icon="lucide:user-plus" :size="14" /> Invite</button>
      </div>

      <!-- Leaderboard snapshot — only renders if you have accepted connections -->
      <PhoneLeaderboardCallout />

      <!-- Swipeable card stack: your network's activity (with reactions) + people -->
      <PhoneSwipeDeck />

      <!-- (Pipeline snapshot, recent activity, and the old cold/overdue
           callouts moved off this screen in the gamification pass — Vibe is
           the play surface; analytics live on Score/Feed.) -->

      <div class="cd-vc" style="border-color: rgba(77, 166, 255, 0.2)">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px">
          <div style="display: flex; align-items: center; gap: 6px">
            <CdEarnestMark :size="15" />
            <span style="font-size: 13px; font-weight: 800; color: #4da6ff">What should I do next?</span>
          </div>
          <button
            class="cd-abtn"
            style="font-size: 10px; padding: 4px 10px; background: transparent; border-color: var(--cd-bdr); color: #4da6ff; width: auto; flex-shrink: 0; white-space: nowrap"
            :disabled="leadSugLoading"
            @click="loadLeadSuggestions"
          >
            <CdEarnestMark :size="12" />
            {{ leadSugLoading ? 'Thinking...' : leadSuggestions.length ? 'Refresh' : 'Get Earnest AI Ideas' }}
          </button>
        </div>
        <div v-if="leadSugError" style="font-size: 12px; color: #f87171; margin-bottom: 6px">{{ leadSugError }}</div>
        <div v-if="!leadSuggestions.length && !leadSugLoading && !leadSugError" style="font-size: 11px; color: var(--cd-dim); line-height: 1.5">
          Tap <strong style="color: #4da6ff">Get Earnest AI Ideas</strong> for personalized suggestions on growing your leads.
        </div>
        <div v-if="leadSugLoading" style="text-align: center; padding: 10px 0">
          <div style="font-size: 12px; color: var(--cd-muted); animation: cd-pulse 1.5s ease-in-out infinite">Analyzing your network...</div>
        </div>
        <div
          v-for="(s, i) in leadSuggestions"
          :key="i"
          style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 10px; padding: 9px 11px; margin-bottom: 6px"
        >
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px">
            <div style="font-size: 13px; font-weight: 700">{{ s.icon }} {{ s.title }}</div>
            <span
              v-if="s.contactId && getContact(s.contactId)?.pipeline_stage"
              style="font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(77,166,255,0.1); border: 1px solid rgba(77,166,255,0.2); border-radius: 4px; padding: 1px 5px; color: #4da6ff; flex-shrink: 0"
            >{{ getContact(s.contactId)?.pipeline_stage?.replace('_', ' ') }}</span>
          </div>
          <div style="font-size: 11px; color: var(--cd-muted); line-height: 1.5">{{ s.body }}</div>
          <div v-if="s.contactId" style="display: flex; gap: 6px; margin-top: 7px">
            <button
              v-if="s.action && SUG_ACTIONS[s.action]"
              class="cd-abtn"
              style="font-size: 10px; padding: 4px 10px; width: auto; flex-shrink: 0"
              :style="'border-color:' + SUG_ACTIONS[s.action].color + '44; color:' + SUG_ACTIONS[s.action].color"
              @click="doSugAction(s)"
            >
              <CdIcon :emoji="SUG_ACTIONS[s.action].icon" :icon="SUG_ACTIONS[s.action].lucide" :size="11" />
              {{ SUG_ACTIONS[s.action].label }}{{ s.action !== 'view' && getContact(s.contactId)?.name ? ' ' + getContact(s.contactId)!.name.split(' ')[0] : '' }}
            </button>
            <button
              v-if="s.action !== 'view'"
              class="cd-abtn"
              style="font-size: 10px; padding: 4px 10px; width: auto; flex-shrink: 0; background: transparent; border-color: var(--cd-bdr); color: var(--cd-dim)"
              @click="goDetail(s.contactId!)"
            >
              <CdIcon emoji="👤" icon="lucide:user" :size="11" /> View
            </button>
          </div>
        </div>
      </div>

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

      <!-- Earnest AI Daily Vibe — a personalized pep-talk (was the mood rotator) -->
      <div class="cd-vibe" :class="vibe ? 'vibe-' + vibe.mood : ''">
        <template v-if="vibe">
          <div class="cd-vibe-emoji">{{ vibe.emoji }}</div>
          <div class="cd-vibe-title">{{ vibe.title }}</div>
          <div class="cd-vibe-body">{{ vibe.body }}</div>
          <div class="cd-vibe-actions">
            <button v-if="vibe.cta" class="cd-vibe-cta" @click="askEarnest">
              <CdEarnestMark :size="12" /> {{ vibe.cta }}
            </button>
            <button class="cd-vibe-refresh" :disabled="vibeLoading" @click="loadVibe">
              <CdIcon icon="lucide:refresh-cw" :size="11" :class="{ spin: vibeLoading }" />
              {{ vibeLoading ? 'Tuning in…' : 'New vibe' }}
            </button>
          </div>
        </template>
        <button v-else class="cd-vibe-empty" :disabled="vibeLoading" @click="loadVibe">
          <span class="cd-vibe-empty-ico"><CdEarnestMark :size="24" /></span>
          <span class="cd-vibe-empty-t">{{ vibeLoading ? 'Reading your momentum…' : 'Get your daily vibe' }}</span>
          <span class="cd-vibe-empty-b">A quick, personal check-in from Earnest — tuned to your week.</span>
        </button>
        <div v-if="vibeError" class="cd-vibe-err">{{ vibeError }}</div>
      </div>

      </div>

      <CdBrandFooter />
    </div>
  </div>
</template>

<style scoped>
/* ── XP hero ── */
.vb-hero {
  border-color: color-mix(in srgb, var(--cd-green) 22%, transparent);
  position: relative;
}
.vb-help {
  position: absolute; top: 10px; right: 10px; width: 22px; height: 22px;
  border-radius: 50%; background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
  color: var(--cd-dim); font-size: 12px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center; z-index: 2;
}
.vb-hero-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.vb-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; }
.vb-chip {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
  border: 1px solid var(--cd-bdr); color: var(--cd-muted);
}
.vb-chip.streak { color: var(--cd-green); border-color: color-mix(in srgb, var(--cd-green) 30%, transparent); }
.vb-chip.shield { color: var(--cd-gold, #ffd700); border-color: rgba(255, 215, 0, 0.3); }
.vb-chip.week { color: #4da6ff; border-color: rgba(77, 166, 255, 0.3); }

/* Weekly XP goal bar */
.vb-goal { margin-bottom: 10px; }
.vb-goal-lbl {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--cd-dim); margin-bottom: 5px;
}
.vb-goal-lbl .hit { color: var(--cd-green); }
.vb-goal-bar {
  height: 8px; border-radius: 999px; overflow: hidden;
  background: var(--cd-bdr);
}
.vb-goal-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, #4da6ff, var(--cd-green));
  transition: width 0.5s ease;
}
.vb-goal-fill.hit { background: var(--cd-green); }
.vb-goal-done {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; color: var(--cd-green); margin-top: 5px;
}

/* ── Today's missions strip ── */
.vb-missions { border-color: color-mix(in srgb, var(--cd-orange, #ff6b35) 24%, transparent); }
.vb-m-hdr {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--cd-dim); margin-bottom: 8px;
}
.vb-m-count {
  margin-left: auto; min-width: 17px; padding: 0 6px; height: 17px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; color: #060810; background: var(--cd-orange, #ff6b35);
}
.vb-m-strip {
  display: flex; gap: 7px; overflow-x: auto; padding-bottom: 2px;
  scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.vb-m-strip::-webkit-scrollbar { display: none; }
.vb-m-chip {
  flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  width: 118px; padding: 9px 10px; border-radius: 12px; cursor: pointer; text-align: left;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
  color: var(--cd-text); font-family: inherit;
  transition: transform 0.1s ease, border-color 0.15s ease, opacity 0.15s ease;
}
.vb-m-chip:active:not(:disabled) { transform: scale(0.97); }
.vb-m-chip.done { opacity: 0.55; cursor: default; }
.vb-m-lbl { font-size: 10.5px; font-weight: 700; line-height: 1.3; }
.vb-m-xp { font-size: 9.5px; font-weight: 800; color: var(--cd-orange, #ff6b35); }
.vb-m-chip.done .vb-m-xp { color: var(--cd-accent); }

/* Earnest AI Daily Vibe — a personalized pep-talk card. Mood-tinted accent
   keeps the warm, emotional tone of the old mood rotator it replaced. */
.cd-vibe {
  --vibe: var(--cd-blue, #4da6ff);
  position: relative;
  text-align: center;
  border-radius: 16px;
  padding: 16px 16px 14px;
  margin-bottom: 10px;
  /* Plain liquid-glass surface to match the deck cards (the glass material is
     applied globally via carddesk.css). The mood lives in the title/icon/CTA. */
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  box-shadow: var(--glass-shadow, 0 18px 40px -22px rgba(0, 0, 0, 0.4));
}
.cd-vibe.vibe-fire { --vibe: #ff6b35; }
.cd-vibe.vibe-steady { --vibe: var(--cd-accent, #00ff87); }
.cd-vibe.vibe-gentle { --vibe: var(--cd-purple, #b87dff); }
.cd-vibe.vibe-nudge { --vibe: var(--cd-blue, #4da6ff); }

.cd-vibe-emoji { font-size: 26px; line-height: 1; margin-bottom: 6px; }
.cd-vibe-title { font-size: 15px; font-weight: 800; color: var(--vibe); margin-bottom: 4px; }
.cd-vibe-body { font-size: 11.5px; color: var(--cd-muted); line-height: 1.6; max-width: 36ch; margin: 0 auto; }

.cd-vibe-actions { display: flex; gap: 8px; justify-content: center; margin-top: 11px; }
.cd-vibe-cta,
.cd-vibe-refresh {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; font-family: inherit;
  padding: 6px 12px; border-radius: 9999px; cursor: pointer;
  transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease;
}
.cd-vibe-cta {
  color: var(--cd-bg, #050710);
  background: var(--vibe);
  border: 1px solid var(--vibe);
}
.cd-vibe-refresh {
  color: var(--cd-dim);
  background: transparent;
  border: 1px solid var(--cd-bdr);
}
.cd-vibe-cta:active,
.cd-vibe-refresh:active { transform: scale(0.96); }
.cd-vibe-refresh:hover { color: var(--vibe); border-color: color-mix(in srgb, var(--vibe) 45%, var(--cd-bdr)); }
.cd-vibe-refresh:disabled { opacity: 0.6; cursor: default; }

.cd-vibe-empty {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: 100%; padding: 4px 0; cursor: pointer;
  background: transparent; border: none; font-family: inherit; color: inherit;
}
.cd-vibe-empty:disabled { cursor: default; }
.cd-vibe-empty-ico {
  display: inline-flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 50%; margin-bottom: 4px; color: var(--vibe);
  background: color-mix(in srgb, var(--vibe) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--vibe) 28%, transparent);
}
.cd-vibe-empty-t { font-size: 14px; font-weight: 800; color: var(--cd-text); }
.cd-vibe-empty-b { font-size: 11px; color: var(--cd-dim); line-height: 1.5; max-width: 32ch; }
.cd-vibe-err { font-size: 11px; color: #f87171; margin-top: 8px; }

.cd-vibe :deep(.spin) { animation: cd-vibe-spin 0.9s linear infinite; }
@keyframes cd-vibe-spin { to { transform: rotate(360deg); } }
</style>
