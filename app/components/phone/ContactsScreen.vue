<script setup lang="ts">
import { RATINGS, RATING_ORDER, getRating, cEmoji } from '~/composables/useConstants'
import { PIPELINE_STAGES } from '~/composables/usePipeline'

const { contacts, followUpStatus } = useContacts()
const { nav, goDetail } = useNavigation()
const { getContactsByStage, getStageInfo } = usePipeline()

type RatingFilter = '' | 'hot' | 'warm' | 'nurture' | 'cold'

const cSearch = ref('')
const cFilter = ref<RatingFilter>('')
const cSort = ref('recent')
const viewMode = ref<'rating' | 'pipeline'>('rating')

const ratingCounts = computed(() => {
  const active = contacts.value.filter((c) => !c.hibernated)
  return {
    all: active.length,
    hot: active.filter((c) => c.rating === 'hot').length,
    warm: active.filter((c) => c.rating === 'warm').length,
    nurture: active.filter((c) => c.rating === 'nurture').length,
    cold: active.filter((c) => c.rating === 'cold').length,
  }
})

const ratingTabItems = computed(() => [
  { key: '' as const, label: 'All', count: ratingCounts.value.all || null },
  ...RATINGS.map((r) => ({
    key: r.key as RatingFilter,
    label: r.label,
    emoji: r.emoji,
    icon: r.lucide,
    dotColor: r.color,
    count: ratingCounts.value[r.key] || null,
  })),
])

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

const pipelineGroups = computed(() => {
  const byStage = getContactsByStage()
  return PIPELINE_STAGES
    .filter((s) => s.key !== 'won' && s.key !== 'lost')
    .map((s) => ({
      ...s,
      contacts: byStage[s.key] ?? [],
    }))
})

const wonLost = computed(() => {
  const byStage = getContactsByStage()
  return {
    won: byStage.won ?? [],
    lost: byStage.lost ?? [],
  }
})
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr" style="padding-bottom: 8px">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
        <div class="cd-stitle">My Network</div>
        <CdButton tier="primary" size="sm" @click="nav('add')">+ Add</CdButton>
      </div>
      <input v-model="cSearch" class="cd-inp" placeholder="Search..." style="margin-bottom: 10px" />

      <!-- View mode toggle: Rating | Pipeline -->
      <CdTabs
        v-model="viewMode"
        :items="[
          { key: 'rating', label: 'Rating', emoji: '⭐', icon: 'lucide:star' },
          { key: 'pipeline', label: 'Pipeline', emoji: '📊', icon: 'lucide:git-branch' },
        ]"
        style="margin-bottom: 10px"
      />

      <!-- Rating filter (only in rating mode) -->
      <div v-if="viewMode === 'rating'" style="overflow-x: auto; padding-bottom: 2px">
        <CdTabs v-model="cFilter" :items="ratingTabItems" size="sm" />
      </div>
    </div>

    <!-- Rating view -->
    <div v-if="viewMode === 'rating'" class="cd-scrl" style="padding: 4px 14px 8px">
      <div v-if="!contacts.length" class="cd-empty">
        <div style="font-size: 40px; margin-bottom: 10px"><CdIcon emoji="🃏" icon="lucide:credit-card" :size="40" /></div>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px">No contacts yet</div>
        <CdButton tier="primary" @click="nav('add')"><CdIcon emoji="📷" icon="lucide:camera" :size="14" /> Scan First Card</CdButton>
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
          <span v-if="(c as any).is_client" style="font-size: 9px; color: #00ff87; font-weight: 700"><CdIcon emoji="💰" icon="lucide:badge-check" :size="9" /> client</span>
          <span v-else-if="followUpStatus(c) === 'overdue'" style="font-size: 9px; color: #ff6b35; font-weight: 700"><CdIcon emoji="⚡" icon="lucide:alert-triangle" :size="9" /> overdue</span>
        </div>
      </div>
    </div>

    <!-- Pipeline view (horizontal scrollable lanes) -->
    <div v-else class="cd-scrl" style="padding: 4px 0 8px">
      <div style="display: flex; gap: 10px; overflow-x: auto; padding: 0 14px; min-height: 200px">
        <div
          v-for="lane in pipelineGroups"
          :key="lane.key"
          style="min-width: 200px; max-width: 220px; flex-shrink: 0; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px; padding: 10px; display: flex; flex-direction: column"
        >
          <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 8px; padding: 0 2px">
            <CdIcon :emoji="lane.emoji" :icon="lane.lucide" :size="13" />
            <span class="cd-eyebrow" style="color: var(--cd-muted)">{{ lane.label }}</span>
            <span class="cd-tab-count" style="margin-left: auto">{{ lane.contacts.length }}</span>
          </div>
          <div v-if="!lane.contacts.length" style="font-size: 11px; color: var(--cd-dim); text-align: center; padding: 20px 0">
            No contacts
          </div>
          <div
            v-for="c in lane.contacts"
            :key="c.id"
            class="cd-crd"
            style="margin-bottom: 6px; cursor: pointer"
            @click="goDetail(c.id)"
          >
            <div class="cd-cbar" :class="c.rating || 'none'"></div>
            <div style="flex: 1; min-width: 0">
              <div class="cd-cnm" style="font-size: 12px">{{ c.name }}</div>
              <div class="cd-csb" style="font-size: 10px">{{ c.company || '' }}</div>
            </div>
            <span v-if="c.estimated_value" style="font-size: 9px; font-weight: 700; color: var(--cd-accent)">
              ${{ c.estimated_value.toLocaleString() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Won/Lost summary -->
      <div style="padding: 10px 14px 0; display: flex; gap: 8px">
        <div style="flex: 1; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 10px; padding: 10px; text-align: center">
          <div style="font-size: 20px; margin-bottom: 2px"><CdIcon emoji="🏆" icon="lucide:trophy" :size="20" /></div>
          <div style="font-size: 18px; font-weight: 800; color: var(--cd-accent)">{{ wonLost.won.length }}</div>
          <div class="cd-eyebrow">Won</div>
        </div>
        <div style="flex: 1; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 10px; padding: 10px; text-align: center">
          <div style="font-size: 20px; margin-bottom: 2px"><CdIcon emoji="❌" icon="lucide:x-circle" :size="20" /></div>
          <div style="font-size: 18px; font-weight: 800; color: var(--cd-muted)">{{ wonLost.lost.length }}</div>
          <div class="cd-eyebrow">Lost</div>
        </div>
      </div>
    </div>
  </div>
</template>
