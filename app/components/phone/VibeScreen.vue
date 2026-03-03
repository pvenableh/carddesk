<script setup lang="ts">
import { VIBE_MOODS } from '~/composables/useConstants'

const { contacts, followUpStatus, daysSince } = useContacts()
const { state: xp, earn } = useXp()
const { nav } = useNavigation()

const coldCs = computed(() =>
  contacts.value.filter((c) => c.rating === 'cold' && !c.hibernated)
)
const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)

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
    <div class="cd-shdr"><div class="cd-stitle">Your Vibe ⚡</div></div>
    <div class="cd-scrl cd-pad">
      <div class="cd-sess-entry" @click="nav('session')">
        <div class="cd-se-top">
          <span style="font-size: 26px">🎙</span>
          <div>
            <div class="cd-se-ttl">Need a session?</div>
            <div class="cd-se-sub">30 seconds. Promise.</div>
          </div>
        </div>
        <div class="cd-se-modes">
          <button class="cd-semp tg" @click.stop="sessionMode = 'tough'; nav('session')">
            💪 Talking to
          </button>
          <button class="cd-semp pk" @click.stop="sessionMode = 'hype'; nav('session')">
            🏆 Picker upper
          </button>
        </div>
      </div>

      <div class="cd-vc hype" @click="earn(20, '🏆', 'Network hype claimed.')">
        <div class="cd-vct">
          <span class="cd-vci">🏆</span>
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
          <span class="cd-vci">❄️</span>
          <div>
            <div class="cd-vch" style="color: #a8d8ea">{{ coldCs[0].name }} has gone quiet.</div>
            <div class="cd-vcb">One check-in could be all it takes.</div>
          </div>
        </div>
        <button class="cd-abtn ice" @click.stop="nav('cold')">🌡 See cold contacts</button>
      </div>

      <div v-if="alertCs.length" class="cd-vc warn" @click="goDetail(alertCs[0].id)">
        <div class="cd-vct">
          <span class="cd-vci">⚡</span>
          <div>
            <div class="cd-vch" style="color: #ff6b35">{{ alertCs[0].name }} is slipping away.</div>
            <div class="cd-vcb">{{ daysSince(alertCs[0]) }} days without a follow-up.</div>
          </div>
        </div>
        <button class="cd-abtn o" @click.stop="goDetail(alertCs[0].id)">⚡ Follow up now</button>
      </div>

      <div class="cd-mood" @click="moodIdx++">
        <div style="font-size: 24px; margin-bottom: 5px">{{ curMood.e }}</div>
        <div class="cd-mc-t" :class="curMood.color">{{ curMood.title }}</div>
        <div class="cd-mc-b">{{ curMood.body }}</div>
        <div style="font-size: 10px; color: #3e4f68; margin-top: 6px">tap to rotate</div>
      </div>
    </div>
  </div>
</template>
