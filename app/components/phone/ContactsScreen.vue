<script setup lang="ts">
import { RATINGS, RATING_ORDER, getRating, cEmoji } from '~/composables/useConstants'
import { PIPELINE_STAGES } from '~/composables/usePipeline'
import ConnectionsView from './ConnectionsView.vue'

const { contacts, followUpStatus, loading: contactsLoading, error: contactsError, fetchContacts } = useContacts()
const { nav, goDetail } = useNavigation()
const { getContactsByStage, getStageInfo } = usePipeline()

type RatingFilter = '' | 'hot' | 'warm' | 'nurture' | 'cold'

const cSearch = ref('')
const cFilter = ref<RatingFilter>('')
const cSort = ref('recent')
const viewMode = ref<'rating' | 'pipeline'>('rating')

// Top-level sub-tab for the "Network" screen: your saved contacts vs. your
// user↔user connections (the orbit + leaderboard live under Connections). The
// activity Feed is now its own bottom-nav tab. Shared via useState so other
// surfaces (e.g. the Vibe leaderboard callout) can deep-link to the Orbit tab.
const netTab = useState<'contacts' | 'connections'>('cd-net-tab', () => 'contacts')
const { incoming } = useConnections()

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

// ── Batch vCard export ─────────────────────────────────────────────────────
const { shareVcf } = useShare()
const { success, error: showError } = useToast()

const selectMode = ref(false)
const selectedIds = ref<Set<string>>(new Set())
const showExport = ref(false)
const includePhotos = ref(false)
const exporting = ref(false)

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedIds.value = next
}
function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selectedIds.value = new Set()
}
// Export targets the explicit selection if any, otherwise everything visible
// under the current rating/search filter.
const exportTargets = computed(() =>
  selectedIds.value.size
    ? filteredCs.value.filter((c) => selectedIds.value.has(c.id))
    : filteredCs.value
)
function openExport() {
  if (!exportTargets.value.length) { showError('No contacts to export'); return }
  showExport.value = true
}
async function runExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    const ids = exportTargets.value.map((c) => c.id)
    const vcf = await $fetch<string>('/api/contacts/export', {
      method: 'POST',
      body: { ids, includePhotos: includePhotos.value },
      responseType: 'text',
    })
    const result = await shareVcf('carddesk-contacts.vcf', vcf)
    if (result !== 'cancelled') success(`Exported ${ids.length} contact${ids.length === 1 ? '' : 's'}`)
    showExport.value = false
    selectMode.value = false
    selectedIds.value = new Set()
  } catch (err: any) {
    showError(err?.data?.message ?? 'Export failed')
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr" style="padding-bottom: 8px">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
        <div class="cd-stitle">My Network</div>
        <div v-if="netTab === 'contacts'" style="display: flex; gap: 6px; align-items: center">
          <CdButton
            v-if="contacts.length"
            tier="utility" size="sm" icon-only
            :class="selectMode ? 'cd-sel-on' : ''"
            aria-label="Select contacts"
            @click="toggleSelectMode"
          >
            <CdIcon emoji="☑️" icon="lucide:list-checks" :size="16" />
          </CdButton>
          <CdButton
            v-if="contacts.length"
            tier="utility" size="sm" icon-only
            aria-label="Export contacts"
            @click="openExport"
          >
            <CdIcon emoji="📤" icon="lucide:download" :size="16" />
          </CdButton>
          <CdButton tier="primary" size="sm" @click="nav('add')">+ Add</CdButton>
        </div>
      </div>

      <!-- Sub-tabs: Contacts (rolodex) | Connections (user↔user orbit) -->
      <CdTabs
        v-model="netTab"
        :items="[
          { key: 'contacts', label: 'Contacts', emoji: '🃏', icon: 'lucide:credit-card' },
          { key: 'connections', label: 'Orbit', emoji: '🪐', icon: 'lucide:orbit', count: incoming.length || null },
        ]"
        style="margin-bottom: 10px"
      />

      <template v-if="netTab === 'contacts'">
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
        <div v-if="viewMode === 'rating'" class="cd-hscroll" style="padding-bottom: 2px">
          <CdTabs v-model="cFilter" :items="ratingTabItems" size="sm" />
        </div>
      </template>
    </div>

    <!-- Connections sub-tab -->
    <ConnectionsView v-if="netTab === 'connections'" />

    <!-- Rating view -->
    <div v-else-if="viewMode === 'rating'" class="cd-scrl" style="padding: 4px var(--cd-gutter) 8px">
      <div class="cd-foot-fill">
      <!-- A failed load must never read as "you have no contacts" — show the
           truth and a way to recover instead of an empty list. -->
      <div v-if="!contacts.length && contactsError" class="cd-empty">
        <div style="font-size: 40px; margin-bottom: 10px"><CdIcon emoji="📡" icon="lucide:wifi-off" :size="40" /></div>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 6px">Couldn't load your contacts</div>
        <div style="font-size: 12px; color: var(--cd-muted); margin-bottom: 12px">They're safe — this is just a connection hiccup.</div>
        <CdButton tier="primary" :disabled="contactsLoading" @click="fetchContacts()">
          <CdIcon emoji="🔄" icon="lucide:refresh-cw" :size="14" /> {{ contactsLoading ? 'Retrying…' : 'Try again' }}
        </CdButton>
      </div>
      <div v-else-if="!contacts.length && contactsLoading" class="cd-empty">
        <div class="cd-spin" style="font-size: 32px; margin-bottom: 10px"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="32" /></div>
        <div style="font-size: 13px; color: var(--cd-muted)">Loading your network…</div>
      </div>
      <div v-else-if="!contacts.length" class="cd-empty">
        <div style="font-size: 40px; margin-bottom: 10px"><CdIcon emoji="🃏" icon="lucide:credit-card" :size="40" /></div>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px">No contacts yet</div>
        <CdButton tier="primary" @click="nav('add')"><CdIcon emoji="📷" icon="lucide:camera" :size="14" /> Scan First Card</CdButton>
      </div>
      <div
        v-for="c in filteredCs"
        :key="c.id"
        class="cd-crd"
        :class="{ 'cd-row-sel': selectMode && selectedIds.has(c.id) }"
        @click="selectMode ? toggleSelect(c.id) : goDetail(c.id)"
      >
        <div class="cd-cbar" :class="c.rating || 'none'"></div>
        <div v-if="selectMode" class="cd-selck" :class="{ on: selectedIds.has(c.id) }">
          <CdIcon v-if="selectedIds.has(c.id)" emoji="✓" icon="lucide:check" :size="13" />
        </div>
        <div class="cd-cav">
          <img v-if="(c as any).imageUrl" :src="(c as any).imageUrl" alt="" />
          <CdIcon v-else :emoji="cEmoji(c)" icon="lucide:user" :size="19" />
        </div>
        <div style="flex: 1; min-width: 0">
          <div class="cd-cnm">{{ c.name }}</div>
          <div class="cd-csb">{{ [c.title, c.company].filter(Boolean).join(' · ') }}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0">
          <span v-if="c.rating" class="cd-rpill" :class="c.rating">
            <CdIcon :emoji="getRating(c.rating)?.emoji ?? ''" :icon="getRating(c.rating)?.lucide" :size="10" /> {{ getRating(c.rating)?.label }}
          </span>
          <span v-if="(c as any).is_client" style="font-size: 9px; color: var(--cd-green); font-weight: 700"><CdIcon emoji="💰" icon="lucide:badge-check" :size="9" /> client</span>
          <span v-else-if="followUpStatus(c) === 'overdue'" style="font-size: 9px; color: #ff6b35; font-weight: 700"><CdIcon emoji="⚡" icon="lucide:alert-triangle" :size="9" /> overdue</span>
        </div>
      </div>
      </div>

      <CdBrandFooter />
    </div>

    <!-- Pipeline view (horizontal scrollable lanes) -->
    <div v-else class="cd-scrl" style="padding: 4px max(0px, calc((100% - 740px) / 2)) 8px">
      <div class="cd-foot-fill">
      <div class="cd-hscroll" style="display: flex; gap: 10px; padding: 0 14px; min-height: 200px">
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

      <CdBrandFooter />
    </div>

    <!-- Batch export sheet -->
    <div v-if="showExport" class="cd-exp-ov" @click.self="showExport = false">
      <div class="cd-exp-card">
        <button class="cd-exp-x" @click="showExport = false"><CdIcon emoji="×" icon="lucide:x" :size="18" /></button>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 4px">Export contacts</div>
        <div style="font-size: 12px; color: var(--cd-dim); margin-bottom: 16px">
          {{ exportTargets.length }} contact{{ exportTargets.length === 1 ? '' : 's' }} → a .vcf you can add to your Contacts app.
        </div>
        <button class="cd-exp-toggle" @click="includePhotos = !includePhotos">
          <div>
            <div style="font-size: 13px; font-weight: 700">Include photos</div>
            <div style="font-size: 11px; color: var(--cd-dim)">Larger file; embeds each contact's image.</div>
          </div>
          <div class="cd-sw" :class="{ on: includePhotos }"><div class="cd-sw-dot"></div></div>
        </button>
        <CdButton tier="primary" block :disabled="exporting || !exportTargets.length" @click="runExport">
          <CdIcon emoji="📤" icon="lucide:download" :size="14" /> {{ exporting ? 'Exporting…' : `Export ${exportTargets.length}` }}
        </CdButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd-sel-on { color: var(--cd-accent); border-color: var(--cd-accent); }
.cd-row-sel { outline: 1.5px solid var(--cd-accent); outline-offset: -1.5px; }
.cd-selck {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1.5px solid var(--cd-bdr);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #06101a;
  margin-right: 2px;
}
.cd-selck.on { background: var(--cd-accent); border-color: var(--cd-accent); }
.cd-exp-ov {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 50;
}
.cd-exp-card {
  position: relative;
  background: var(--cd-bg);
  border: 1px solid var(--cd-bdr);
  border-radius: 20px;
  padding: 24px;
  max-width: 320px;
  width: 100%;
}
.cd-exp-x {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--cd-dim);
  cursor: pointer;
}
.cd-exp-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 11px 12px;
  margin-bottom: 14px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  color: var(--cd-text);
  cursor: pointer;
}
.cd-sw {
  flex-shrink: 0;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: var(--cd-bdr);
  transition: background 0.15s;
  position: relative;
}
.cd-sw.on { background: var(--cd-accent); }
.cd-sw-dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
}
.cd-sw.on .cd-sw-dot { transform: translateX(18px); }
</style>
