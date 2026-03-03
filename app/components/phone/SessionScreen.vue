<script setup lang="ts">
import { TOUGH_CARDS, HYPE_CARDS } from '~/composables/useConstants'

const { earn } = useXp()

const sessionMode = ref<'tough' | 'hype' | null>(null)
const toughIdx = ref(0)
const hypeIdx = ref(0)

const curTough = computed(() => TOUGH_CARDS[toughIdx.value % TOUGH_CARDS.length])
const curHype = computed(() => HYPE_CARDS[hypeIdx.value % HYPE_CARDS.length])
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
          <div style="font-size: 28px; margin-bottom: 6px">💪</div>
          <div class="cd-mc-lbl">Need a talking to</div>
          <div class="cd-mc-sub">Real talk. Time to move.</div>
        </div>
        <div class="cd-mcard pk" :class="{ sel: sessionMode === 'hype' }" @click="sessionMode = 'hype'">
          <div style="font-size: 28px; margin-bottom: 6px">🏆</div>
          <div class="cd-mc-lbl">Picker upper</div>
          <div class="cd-mc-sub">Pure hype.</div>
        </div>
      </div>
      <Transition name="cd-pop">
        <div v-if="sessionMode === 'tough'" class="cd-scard tc">
          <div class="cd-sc-eye orange">Round {{ (toughIdx % 3) + 1 }} of 3</div>
          <div class="cd-sc-q">"{{ curTough.q }}"</div>
          <div class="cd-sc-b" v-html="curTough.b"></div>
          <button class="cd-abtn o" @click="earn(25, '✉️', 'Sent.'); toughIdx++">
            ✉ Send one text +25 XP
          </button>
          <div class="cd-nxt" @click="toughIdx++">Another one →</div>
        </div>
      </Transition>
      <Transition name="cd-pop">
        <div v-if="sessionMode === 'hype'" class="cd-scard hc">
          <div class="cd-sc-eye green">Round {{ (hypeIdx % 3) + 1 }} of 3</div>
          <div class="cd-sc-q">"{{ curHype.q }}"</div>
          <div class="cd-sc-b" v-html="curHype.b"></div>
          <button class="cd-abtn g" @click="earn(25, '🚀', 'Logged.'); hypeIdx++">
            🚀 Log a touchpoint +25 XP
          </button>
          <div class="cd-nxt" @click="hypeIdx++">Another one →</div>
        </div>
      </Transition>
      <div v-if="sessionMode" class="cd-lucky">
        <div style="font-size: 18px; margin-bottom: 4px">✨</div>
        <div style="font-size: 15px; font-weight: 800; color: #00ff87; margin-bottom: 3px">Remember</div>
        <div style="font-size: 12px; color: #8898b0; line-height: 1.6">
          <em style="color: #f0f4ff">They are the lucky ones to hear from you.</em><br />
          You reaching out is a gift. Own it.
        </div>
      </div>
    </div>
  </div>
</template>
