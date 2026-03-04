<script setup lang="ts">
import { VIBE_MOODS, getAct, cEmoji } from '~/composables/useConstants'
import { fmtRelative } from '~/composables/useFormatters'
import type { CdActivity, CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince } = useContacts()
const { state: xp, earn, curLevel } = useXp()
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

    const data = await $fetch<Array<{ icon: string; title: string; body: string }>>('/api/ai-lead-suggestions', {
      method: 'POST',
      body: {
        contacts: { total: contacts.value.length, hot, warm, cold, clients, overdue },
        recentActivity: recent,
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

      <div class="cd-vc hype" @click="earn(20, '🏆', 'Network hype claimed.')">
        <div class="cd-vct">
          <span class="cd-vci"><CdIcon emoji="🏆" icon="lucide:trophy" /></span>
          <div>
            <div class="cd-vch" style="color: #00ff87">Nobody crushes it like you.</div>
            <div class="cd-vcb">
              {{ contacts.length }} contacts · {{ xp.streak }}-day streak.
              <strong>You're building something real.</strong>
            </div>
          </div>
          <span class="cd-xpb">+20 XP</span>
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
            style="font-size: 10px; padding: 4px 10px; background: transparent; border-color: #1c2330; color: #4da6ff"
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
