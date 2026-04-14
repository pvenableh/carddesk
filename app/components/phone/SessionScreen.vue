<script setup lang="ts">
import { TOUGH_CARDS, HYPE_CARDS } from '~/composables/useConstants'

const { state: xp, earn } = useXp()
const { contacts, followUpStatus } = useContacts()
const { profile } = useProfile()
const { getPipelineStats } = usePipeline()

const sessionMode = ref<'tough' | 'hype' | null>(null)
const toughIdx = ref(0)
const hypeIdx = ref(0)

// AI-personalized cards (fallback to hardcoded)
const aiToughCards = ref<Array<{ q: string; b: string }>>([])
const aiHypeCards = ref<Array<{ q: string; b: string }>>([])
const aiLoading = ref<'tough' | 'hype' | null>(null)

const toughCards = computed(() => aiToughCards.value.length ? aiToughCards.value : [...TOUGH_CARDS])
const hypeCards = computed(() => aiHypeCards.value.length ? aiHypeCards.value : [...HYPE_CARDS])

const curTough = computed(() => toughCards.value[toughIdx.value % toughCards.value.length])
const curHype = computed(() => hypeCards.value[hypeIdx.value % hypeCards.value.length])

function contactStats() {
  const hot = contacts.value.filter((c) => c.rating === 'hot' && !c.hibernated).length
  const overdue = contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue').length
  const total = contacts.value.length
  const clients = contacts.value.filter((c) => (c as any).is_client).length
  return { hot, overdue, total, clients }
}

async function loadAiCards(mode: 'tough' | 'hype') {
  aiLoading.value = mode
  try {
    const stats = contactStats()
    const pStats = getPipelineStats()
    const data = await $fetch<Array<{ q: string; b: string }>>('/api/ai-sayings', {
      method: 'POST',
      body: {
        mode,
        contacts: stats,
        xp: { level: xp.value.level, streak: xp.value.streak },
        pipeline: {
          total: Object.values(pStats.stageCounts).reduce((a: number, b: any) => a + b, 0),
          negotiating: pStats.stageCounts.negotiating ?? 0,
          stalled: pStats.stalledCount,
          won: pStats.stageCounts.won ?? 0,
          lost: pStats.stageCounts.lost ?? 0,
          value: pStats.totalValue,
        },
      },
    })
    if (mode === 'tough') aiToughCards.value = data
    else aiHypeCards.value = data
  } catch { /* keep hardcoded fallback */ }
  finally { aiLoading.value = null }
}

watch(sessionMode, (mode) => {
  if (mode === 'tough' && !aiToughCards.value.length) loadAiCards('tough')
  if (mode === 'hype' && !aiHypeCards.value.length) loadAiCards('hype')
})
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-scrl cd-pad">
      <div style="text-align: center; padding: 14px 0 16px">
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 44px; line-height: 1">
          Need a session?
        </div>
        <div style="font-size: 12px; color: #8898b0; margin-top: 4px">Pick your vibe.</div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px">
        <div class="cd-mcard tg" :class="{ sel: sessionMode === 'tough' }" @click="sessionMode = 'tough'">
          <div style="font-size: 28px; margin-bottom: 6px"><CdIcon emoji="💪" icon="lucide:dumbbell" :size="28" /></div>
          <div class="cd-mc-lbl">Need a talking to</div>
          <div class="cd-mc-sub">Real talk. Time to move.</div>
        </div>
        <div class="cd-mcard pk" :class="{ sel: sessionMode === 'hype' }" @click="sessionMode = 'hype'">
          <div style="font-size: 28px; margin-bottom: 6px"><CdIcon emoji="🏆" icon="lucide:trophy" :size="28" /></div>
          <div class="cd-mc-lbl">Picker upper</div>
          <div class="cd-mc-sub">Pure hype.</div>
        </div>
      </div>
      <Transition name="cd-pop" mode="out-in">
        <div v-if="sessionMode === 'tough'" key="tough" class="cd-scard tc">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px">
            <div class="cd-sc-eye orange">Round {{ (toughIdx % toughCards.length) + 1 }} of {{ toughCards.length }}</div>
            <button
              v-if="aiToughCards.length"
              style="font-size: 9px; color: #3e4f68; background: none; border: none; cursor: pointer; padding: 2px 4px"
              @click.stop="loadAiCards('tough')"
            ><CdIcon emoji="🔄" icon="lucide:refresh-cw" :size="9" /> refresh</button>
          </div>
          <div v-if="aiLoading === 'tough'" style="text-align: center; padding: 12px 0; font-size: 12px; color: #8898b0; animation: cd-pulse 1.5s ease-in-out infinite">
            Personalizing your session...
          </div>
          <template v-else>
            <div v-if="aiToughCards.length" style="font-size: 9px; color: #4da6ff; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px">
              <CdIcon emoji="✨" icon="lucide:sparkles" :size="9" /> Personalized for you
            </div>
            <div class="cd-sc-q">"{{ curTough.q }}"</div>
            <div class="cd-sc-b" v-html="curTough.b"></div>
            <button class="cd-abtn o" @click="earn(25, '✉️', 'Sent.'); toughIdx++">
              <CdIcon emoji="✉" icon="lucide:send" :size="14" /> Send one text +25 XP
            </button>
            <div class="cd-nxt" @click="toughIdx++">Another one →</div>
          </template>
        </div>
        <div v-else-if="sessionMode === 'hype'" key="hype" class="cd-scard hc">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px">
            <div class="cd-sc-eye green">Round {{ (hypeIdx % hypeCards.length) + 1 }} of {{ hypeCards.length }}</div>
            <button
              v-if="aiHypeCards.length"
              style="font-size: 9px; color: #3e4f68; background: none; border: none; cursor: pointer; padding: 2px 4px"
              @click.stop="loadAiCards('hype')"
            ><CdIcon emoji="🔄" icon="lucide:refresh-cw" :size="9" /> refresh</button>
          </div>
          <div v-if="aiLoading === 'hype'" style="text-align: center; padding: 12px 0; font-size: 12px; color: #8898b0; animation: cd-pulse 1.5s ease-in-out infinite">
            Personalizing your session...
          </div>
          <template v-else>
            <div v-if="aiHypeCards.length" style="font-size: 9px; color: #4da6ff; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px">
              <CdIcon emoji="✨" icon="lucide:sparkles" :size="9" /> Personalized for you
            </div>
            <div class="cd-sc-q">"{{ curHype.q }}"</div>
            <div class="cd-sc-b" v-html="curHype.b"></div>
            <button class="cd-abtn g" @click="earn(25, '🚀', 'Logged.'); hypeIdx++">
              <CdIcon emoji="🚀" icon="lucide:rocket" :size="14" /> Log a touchpoint +25 XP
            </button>
            <div class="cd-nxt" @click="hypeIdx++">Another one →</div>
          </template>
        </div>
      </Transition>
      <div v-if="sessionMode" class="cd-lucky">
        <div style="font-size: 18px; margin-bottom: 4px"><CdIcon emoji="✨" icon="lucide:sparkles" :size="18" /></div>
        <div style="font-size: 15px; font-weight: 800; color: #00ff87; margin-bottom: 3px">Remember</div>
        <div style="font-size: 12px; color: #8898b0; line-height: 1.6">
          <em style="color: #f0f4ff">They are the lucky ones to hear from you.</em><br />
          You reaching out is a gift. Own it.
        </div>
      </div>
    </div>
  </div>
</template>
