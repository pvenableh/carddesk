<script setup lang="ts">
import { RATINGS, RATING_ORDER, getRating, cEmoji } from '~/composables/useConstants'

const { contacts, followUpStatus } = useContacts()
const { nav, goDetail } = useNavigation()

const cSearch = ref('')
const cFilter = ref('')
const cSort = ref('recent')

const filteredCs = computed(() => {
  const q = cSearch.value.toLowerCase()
  let list = contacts.value.filter(
    (c) =>
      !c.hibernated &&
      (c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)) &&
      (!cFilter.value || c.rating === cFilter.value)
  )
  if (cSort.value === 'hot')
    list = [...list].sort((a, b) => (RATING_ORDER[a.rating ?? ''] ?? 4) - (RATING_ORDER[b.rating ?? ''] ?? 4))
  if (cSort.value === 'name')
    list = [...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  return list
})

const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr" style="padding-bottom: 8px">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px">
        <div class="cd-stitle">My Network</div>
        <button class="cd-abtn g" style="width: auto; padding: 7px 12px; font-size: 12px" @click="nav('add')">+ Add</button>
      </div>
      <input v-model="cSearch" class="cd-inp" placeholder="Search..." style="margin-bottom: 8px" />
      <div style="display: flex; gap: 5px; overflow-x: auto; padding-bottom: 2px">
        <button class="cd-pill" :class="{ on: cFilter === '' }" @click="cFilter = ''">All</button>
        <button
          v-for="r in RATINGS"
          :key="r.key"
          class="cd-pill"
          :class="[{ on: cFilter === r.key }, r.key]"
          @click="cFilter = cFilter === r.key ? '' : r.key"
        ><CdIcon :emoji="r.emoji" :icon="r.lucide" :size="12" /> {{ r.label }}</button>
      </div>
    </div>
    <div class="cd-scrl" style="padding: 4px 14px 8px">
      <div v-if="!contacts.length" class="cd-empty">
        <div style="font-size: 40px; margin-bottom: 10px"><CdIcon emoji="🃏" icon="lucide:credit-card" :size="40" /></div>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px">No contacts yet</div>
        <button class="cd-abtn g" @click="nav('add')"><CdIcon emoji="📷" icon="lucide:camera" :size="14" /> Scan First Card</button>
      </div>
      <div v-for="c in filteredCs" :key="c.id" class="cd-crd" @click="goDetail(c.id)">
        <div class="cd-cbar" :class="c.rating || 'none'"></div>
        <div class="cd-cav"><CdIcon :emoji="cEmoji(c)" icon="lucide:user" :size="19" /></div>
        <div style="flex: 1; min-width: 0">
          <div class="cd-cnm">{{ c.name }}</div>
          <div class="cd-csb">{{ [c.title, c.company].filter(Boolean).join(' · ') }}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0">
          <span v-if="c.rating" class="cd-rpill" :class="c.rating">
            <CdIcon :emoji="getRating(c.rating)?.emoji ?? ''" :icon="getRating(c.rating)?.lucide" :size="10" /> {{ getRating(c.rating)?.label }}
          </span>
          <span v-if="followUpStatus(c) === 'overdue'" style="font-size: 9px; color: #ff6b35; font-weight: 700"><CdIcon emoji="⚡" icon="lucide:alert-triangle" :size="9" /> overdue</span>
        </div>
      </div>
    </div>
  </div>
</template>
