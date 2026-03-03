<script setup lang="ts">
import { VIBE_MOODS, getAct, cEmoji } from '~/composables/useConstants'
import { fmtRelative } from '~/composables/useFormatters'
import type { CdActivity, CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince } = useContacts()
const { state: xp, earn } = useXp()
const { nav } = useNavigation()

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

      <div v-if="recentActivity.length" class="cd-feed">
        <div class="cd-feed-hdr">
          <CdIcon emoji="📡" icon="lucide:activity" :size="13" />
          <span>Recent Activity</span>
        </div>
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
