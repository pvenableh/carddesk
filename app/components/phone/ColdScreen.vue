<script setup lang="ts">
import { cEmoji, coldWarmer } from '~/composables/useConstants'

const { contacts, hibernate, wake } = useContacts()
const { earn } = useXp()

const coldCs = computed(() => contacts.value.filter((c) => c.rating === 'cold' && !c.hibernated))
const hibCs = computed(() => contacts.value.filter((c) => c.hibernated))
const openCold = ref<Set<string>>(new Set())

function toggleCold(id: string) {
  openCold.value.has(id) ? openCold.value.delete(id) : openCold.value.add(id)
}

async function doHibernate(id: string) {
  await hibernate(id)
  openCold.value.delete(id)
}

async function doWake(id: string) {
  await wake(id)
  earn(10, '🌅', 'Welcome back.')
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr">
      <div class="cd-stitle">❄️ Cold Contacts</div>
    </div>
    <div class="cd-scrl cd-pad">
      <div v-if="!coldCs.length && !hibCs.length" class="cd-empty">
        <div style="font-size: 40px; margin-bottom: 10px">❄️</div>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 6px">No cold contacts</div>
        <div style="font-size: 12px; color: #8898b0">Rate a contact ❄️ Cold and they'll appear here.</div>
      </div>
      <template v-if="coldCs.length">
        <div class="cd-sec-lbl">❄️ Cold</div>
        <div v-for="c in coldCs" :key="c.id" class="cd-cold-card">
          <div class="cd-cc-top" @click="toggleCold(c.id)">
            <div class="cd-cc-av">{{ cEmoji(c) }}</div>
            <div style="flex: 1; min-width: 0">
              <div class="cd-cc-nm">{{ c.name }}</div>
              <div class="cd-cc-sb">{{ [c.title, c.company].filter(Boolean).join(' · ') }}</div>
            </div>
            <span class="cd-cpill">❄️ Cold</span>
          </div>
          <Transition name="cd-expand">
            <div v-if="openCold.has(c.id)" class="cd-cw">
              <div class="cd-cw-q">"{{ coldWarmer(c) }}"</div>
              <div style="display: flex; gap: 6px">
                <button class="cd-cwb reach" @click="earn(25, '📧', 'Reached out.'); toggleCold(c.id)">
                  📧 Reach out +25 XP
                </button>
                <button class="cd-cwb hib" @click="doHibernate(c.id)">Hibernate 😴</button>
              </div>
            </div>
          </Transition>
        </div>
      </template>
      <template v-if="hibCs.length">
        <div class="cd-sec-lbl" style="margin-top: 16px">😴 Hibernating</div>
        <div v-for="c in hibCs" :key="c.id" class="cd-cold-card" style="opacity: 0.6">
          <div class="cd-cc-top" @click="toggleCold(c.id + '_h')">
            <div class="cd-cc-av">{{ cEmoji(c) }}</div>
            <div style="flex: 1; min-width: 0">
              <div class="cd-cc-nm">{{ c.name }}</div>
              <div class="cd-cc-sb">{{ [c.title, c.company].filter(Boolean).join(' · ') }}</div>
            </div>
            <span class="cd-hpill">😴</span>
          </div>
          <Transition name="cd-expand">
            <div v-if="openCold.has(c.id + '_h')" class="cd-cw">
              <div class="cd-cw-q" style="color: #3e4f68">Smart networkers pause, not delete.</div>
              <button class="cd-cwb wake" @click="doWake(c.id); openCold.delete(c.id + '_h')">
                Wake up 🌅
              </button>
            </div>
          </Transition>
        </div>
      </template>
    </div>
  </div>
</template>
