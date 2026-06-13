<script setup lang="ts">
import { RATINGS, RATING_ORDER, getRating, cEmoji } from '~/composables/useConstants'
import { PIPELINE_STAGES, GOAL_OPTIONS } from '~/composables/usePipeline'
import ConnectionsView from './ConnectionsView.vue'

const { contacts, updateContact, followUpStatus, loading: contactsLoading, error: contactsError, fetchContacts } = useContacts()
const { nav, goDetail } = useNavigation()
const { getContactsByStage, getStageInfo, setGoalTag, moveToStage } = usePipeline()

type RatingFilter = '' | 'hot' | 'warm' | 'nurture' | 'cold'

// Inline rating quick-set: tapping a card's temperature chip opens this picker
// (without navigating into the contact). Holds the contact being re-rated.
const ratingFor = ref<any | null>(null)
async function setListRating(key: string | null) {
  const c = ratingFor.value
  ratingFor.value = null
  if (!c) return
  const next = c.rating === key ? null : key
  await updateContact(c.id, { rating: next } as any)
}

// Kanban drag-and-drop — drag a card between the forward stage columns (desktop).
const draggingId = ref<string | null>(null)
const dragOverStage = ref<string | null>(null)
function onCardDragStart(c: any, e: DragEvent) {
  draggingId.value = c.id
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id) }
}
function onCardDragEnd() {
  draggingId.value = null
  dragOverStage.value = null
}
async function onDropStage(stageKey: string) {
  const id = draggingId.value
  dragOverStage.value = null
  draggingId.value = null
  if (!id) return
  const c = contacts.value.find((x) => x.id === id)
  if (!c || c.pipeline_stage === stageKey) return
  await moveToStage(id, stageKey as any)
}

// Inline goal picker — tapping a card's goal tag opens this to change/clear it.
const goalFor = ref<any | null>(null)
async function setListGoal(goal: 'client' | 'partner' | null) {
  const c = goalFor.value
  goalFor.value = null
  if (!c) return
  // Tapping the current goal clears it.
  const next = c.opportunity_goal === goal ? null : goal
  await setGoalTag(c.id, next)
}

const cSearch = ref('')
const cFilter = ref<RatingFilter>('')
const cSort = ref('recent')
const viewMode = ref<'rating' | 'pipeline'>('rating')

// First-run pipeline coachmark — auto-starts the first time the lanes are shown.
const { maybeAutoStart: maybeStartTour, startTour } = usePipelineTour()
watch(viewMode, (m) => { if (m === 'pipeline') maybeStartTour() })

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
    .filter((s) => s.group === 'forward')
    .map((s) => ({
      ...s,
      contacts: byStage[s.key] ?? [],
    }))
})

// Settled outcomes shown as a summary row beneath the active lanes.
const outcomes = computed(() => {
  const byStage = getContactsByStage()
  return {
    client: byStage.client ?? [],
    partner: byStage.partner ?? [],
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

      <!-- Sub-tabs: My Deck (cards you've collected — the rolodex) | Orbit
           (user↔user connections). "Deck" vs "Contacts" keeps the two near-
           synonyms from blurring: deck = people you've met, orbit = people
           playing CardDesk with you. -->
      <CdTabs
        v-model="netTab"
        :items="[
          { key: 'contacts', label: 'My Deck', emoji: '🃏', icon: 'lucide:credit-card' },
          { key: 'connections', label: 'Orbit', emoji: '🪐', icon: 'lucide:orbit', count: incoming.length || null },
        ]"
        style="margin-bottom: 10px"
      />

      <template v-if="netTab === 'contacts'">
        <input v-model="cSearch" class="cd-inp" placeholder="Search..." style="margin-bottom: 10px" />

        <!-- View mode toggle: List (browse, filter by temperature) | Pipeline (board by stage).
             key stays 'rating' to avoid churning the viewMode checks; only the label changed. -->
        <CdTabs
          v-model="viewMode"
          :items="[
            { key: 'rating', label: 'List', emoji: '📋', icon: 'lucide:list' },
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
          <button v-if="c.rating" type="button" class="cd-rpill" :class="c.rating" style="cursor: pointer; font-family: inherit" title="Tap to change temperature" @click.stop="ratingFor = c">
            <CdIcon :emoji="getRating(c.rating)?.emoji ?? ''" :icon="getRating(c.rating)?.lucide" :size="9" /> {{ getRating(c.rating)?.label }}
          </button>
          <button v-else type="button" class="cd-mpill" style="color: var(--cd-dim); background: none; border-style: dashed; cursor: pointer; font-family: inherit" title="Set temperature" @click.stop="ratingFor = c">
            <CdIcon emoji="🌡️" icon="lucide:thermometer" :size="9" /> Rate
          </button>
          <span v-if="(c as any).is_client" class="cd-mpill" style="color: var(--cd-green); border-color: rgba(0,255,135,0.3); background: rgba(0,255,135,0.1)"><CdIcon emoji="💰" icon="lucide:badge-check" :size="9" /> client</span>
          <span v-else-if="(c as any).is_partner" class="cd-mpill" style="color: #7f77dd; border-color: rgba(127,119,221,0.35); background: rgba(127,119,221,0.12)"><CdIcon emoji="🤝" icon="lucide:handshake" :size="9" /> partner</span>
          <button v-else-if="(c as any).opportunity_goal === 'partner'" type="button" class="cd-mpill" style="color: #7f77dd; border-color: rgba(127,119,221,0.4); background: rgba(127,119,221,0.08); border-style: dashed; cursor: pointer; font-family: inherit" @click.stop="goalFor = c"><CdIcon emoji="🤝" icon="lucide:handshake" :size="9" /> partner goal</button>
          <button v-else-if="(c as any).opportunity_goal === 'client'" type="button" class="cd-mpill" style="color: #4da6ff; border-color: rgba(77,166,255,0.4); background: rgba(77,166,255,0.08); border-style: dashed; cursor: pointer; font-family: inherit" @click.stop="goalFor = c"><CdIcon emoji="💼" icon="lucide:briefcase" :size="9" /> client goal</button>
          <span v-if="c.linked_user" class="cd-mpill" style="color: var(--cd-purple, #b87dff); border-color: rgba(184,125,255,0.3); background: rgba(184,125,255,0.1)"><CdIcon emoji="🪐" icon="lucide:orbit" :size="9" /> joined</span>
        </div>
      </div>
      </div>

      <CdBrandFooter />
    </div>

    <!-- Pipeline view — kanban board; columns fill the container, drag a card to change its stage -->
    <div v-else class="cd-scrl" style="padding: 4px var(--cd-gutter) 8px">
      <div class="cd-foot-fill">
      <button
        style="display: inline-flex; align-items: center; gap: 5px; margin: 0 14px 8px; padding: 4px 0; background: none; border: none; color: var(--cd-dim); font-size: 11px; font-weight: 600; cursor: pointer"
        @click="startTour"
      ><CdIcon emoji="💡" icon="lucide:help-circle" :size="12" /> How the pipeline works · drag a card to move it</button>
      <div class="cd-kanban">
        <div
          v-for="lane in pipelineGroups"
          :key="lane.key"
          class="cd-kanban-lane"
          :class="{ 'is-drop': dragOverStage === lane.key }"
          @dragover.prevent="dragOverStage = lane.key"
          @dragleave="dragOverStage = (dragOverStage === lane.key ? null : dragOverStage)"
          @drop.prevent="onDropStage(lane.key)"
        >
          <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 8px; padding: 0 2px">
            <CdIcon :emoji="lane.emoji" :icon="lane.lucide" :size="13" />
            <span class="cd-eyebrow" style="color: var(--cd-muted)">{{ lane.label }}</span>
            <span class="cd-tab-count" style="margin-left: auto">{{ lane.contacts.length }}</span>
          </div>
          <div v-if="!lane.contacts.length" style="font-size: 11px; color: var(--cd-dim); text-align: center; padding: 20px 0">
            {{ dragOverStage === lane.key ? 'Drop here' : 'No contacts' }}
          </div>
          <div
            v-for="c in lane.contacts"
            :key="c.id"
            class="cd-crd"
            :draggable="true"
            :style="`margin-bottom: 6px; ${draggingId === c.id ? 'cursor: grabbing; opacity: 0.45' : 'cursor: grab'}`"
            @click="goDetail(c.id)"
            @dragstart="onCardDragStart(c, $event)"
            @dragend="onCardDragEnd"
          >
            <div class="cd-cbar" :class="c.rating || 'none'"></div>
            <div style="flex: 1; min-width: 0">
              <div class="cd-cnm" style="font-size: 12px">{{ c.name }}</div>
              <div class="cd-csb" style="font-size: 10px">{{ c.company || '' }}</div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0">
              <span v-if="(c as any).opportunity_goal === 'partner'" style="font-size: 13px" aria-label="Goal: partner"><CdIcon emoji="🤝" icon="lucide:handshake" :size="12" /></span>
              <span v-else-if="(c as any).opportunity_goal === 'client'" style="font-size: 13px" aria-label="Goal: client"><CdIcon emoji="💼" icon="lucide:briefcase" :size="12" /></span>
              <span v-if="c.estimated_value" style="font-size: 9px; font-weight: 700; color: var(--cd-accent)">
                ${{ c.estimated_value.toLocaleString() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Graduated / settled outcomes -->
      <div style="padding: 10px 14px 0; display: flex; gap: 8px">
        <div style="flex: 1; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 10px; padding: 10px; text-align: center">
          <div style="font-size: 20px; margin-bottom: 2px"><CdIcon emoji="💰" icon="lucide:badge-check" :size="20" /></div>
          <div style="font-size: 18px; font-weight: 800; color: var(--cd-accent)">{{ outcomes.client.length }}</div>
          <div class="cd-eyebrow">Clients</div>
        </div>
        <div style="flex: 1; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 10px; padding: 10px; text-align: center">
          <div style="font-size: 20px; margin-bottom: 2px"><CdIcon emoji="🤝" icon="lucide:handshake" :size="20" /></div>
          <div style="font-size: 18px; font-weight: 800; color: #7f77dd">{{ outcomes.partner.length }}</div>
          <div class="cd-eyebrow">Partners</div>
        </div>
        <div style="flex: 1; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 10px; padding: 10px; text-align: center">
          <div style="font-size: 20px; margin-bottom: 2px"><CdIcon emoji="🌙" icon="lucide:moon" :size="20" /></div>
          <div style="font-size: 18px; font-weight: 800; color: var(--cd-muted)">{{ outcomes.lost.length }}</div>
          <div class="cd-eyebrow">Not now</div>
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

    <!-- Inline rating picker — opened by tapping a card's temperature chip. -->
    <Transition name="cd-pop">
      <div v-if="ratingFor" style="position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center" @click.self="ratingFor = null">
        <div style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px 14px 0 0; padding: 16px; width: 100%; max-width: 768px">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">Set temperature</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">{{ ratingFor.name }}</div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <button
              v-for="r in RATINGS"
              :key="r.key"
              style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 600; cursor: pointer; text-align: left"
              :style="ratingFor.rating === r.key ? 'border-color:' + r.color + ';background:' + r.color + '14;color:' + r.color : ''"
              @click="setListRating(r.key)"
            >
              <CdIcon :emoji="r.emoji" :icon="r.lucide" :size="16" /> {{ r.label }}
              <span v-if="ratingFor.rating === r.key" style="margin-left: auto; font-size: 10px">current · tap to clear</span>
            </button>
          </div>
          <button style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="ratingFor = null">Cancel</button>
        </div>
      </div>
    </Transition>

    <!-- Inline goal picker — opened by tapping a card's goal tag. -->
    <Transition name="cd-pop">
      <div v-if="goalFor" style="position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center" @click.self="goalFor = null">
        <div style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px 14px 0 0; padding: 16px; width: 100%; max-width: 768px">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">What are you going for?</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">{{ goalFor.name }}</div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <button
              v-for="g in GOAL_OPTIONS"
              :key="g.key"
              style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 600; cursor: pointer; text-align: left"
              :style="goalFor.opportunity_goal === g.key ? (g.key === 'partner' ? 'border-color:#7f77dd;background:rgba(127,119,221,0.1);color:#7f77dd' : 'border-color:#4da6ff;background:rgba(77,166,255,0.1);color:#4da6ff') : ''"
              @click="setListGoal(g.key)"
            >
              <CdIcon :emoji="g.emoji" :icon="g.lucide" :size="16" /> {{ g.label }}
              <span v-if="goalFor.opportunity_goal === g.key" style="margin-left: auto; font-size: 10px">current · tap to clear</span>
            </button>
          </div>
          <button style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="goalFor = null">Cancel</button>
        </div>
      </div>
    </Transition>

    <!-- First-run pipeline coachmark -->
    <PhonePipelineTour />
  </div>
</template>

<style scoped>
/* Kanban board: columns fill the container width on desktop; on narrow screens
   they hold a usable min width and the board scrolls horizontally. */
.cd-kanban {
  display: flex;
  gap: 10px;
  padding: 0 14px;
  min-height: 280px;
  align-items: stretch;
  overflow-x: auto;
}
.cd-kanban-lane {
  flex: 1 1 0;
  min-width: 150px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.cd-kanban-lane.is-drop {
  border-color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 8%, var(--cd-bg2));
}

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
