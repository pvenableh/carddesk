<script setup lang="ts">
import { RATINGS, RATING_ORDER, getRating, getAct, industryTagStyle } from '~/composables/useConstants'
import { PIPELINE_STAGES, GOAL_OPTIONS } from '~/composables/usePipeline'
import ConnectionsView from './ConnectionsView.vue'

const { contacts, updateContact, togglePin, followUpStatus, lastActivity, lastMeaningfulActivity, daysSince, loading: contactsLoading, error: contactsError, fetchContacts } = useContacts()
const { nav, goDetail } = useNavigation()
const { getContactsByStage, getStageInfo, setGoalTag, moveToStage } = usePipeline()
const { listPlans, dirty: plansDirty } = usePlans()

// Which contacts have an active plan — drives the "plan" badge on cards. One
// lightweight fetch of the user's active plans, reduced to a Set of contact
// ids; refreshed whenever a plan/task mutates anywhere (usePlans `dirty`).
const planContactIds = ref<Set<string>>(new Set())
async function loadPlanFlags() {
  try {
    const plans = await listPlans({ status: 'active' })
    planContactIds.value = new Set(plans.filter((p) => p.contact).map((p) => p.contact as string))
  } catch {
    // Non-fatal: if this fails the badge just doesn't show.
  }
}
onMounted(loadPlanFlags)
watch(plansDirty, loadPlanFlags)

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

// Inline "last touchpoint" peek — tapping the chevron on a list card expands a
// quick summary of the most recent activity without navigating into the detail
// screen. Set-based so multiple cards can stay open at once.
const peeked = ref<Set<string>>(new Set())
function togglePeek(id: string) {
  peeked.value.has(id) ? peeked.value.delete(id) : peeked.value.add(id)
  peeked.value = new Set(peeked.value)
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
const iFilter = ref('')
const cSort = ref('recent')
const viewMode = ref<'rating' | 'pipeline'>('rating')

// Inline pin toggle — pins a contact to the top of the list without leaving it.
async function togglePinned(c: any) {
  await togglePin(c.id)
}

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

// Industry filter — only offer industries that actually appear among the
// active contacts, so the chip row stays short and relevant. Hidden entirely
// when there's 0–1 distinct industry to filter by.
const industryTabItems = computed(() => {
  const counts = new Map<string, number>()
  for (const c of contacts.value) {
    if (c.hibernated) continue
    const ind = (c as any).industry
    if (ind) counts.set(ind, (counts.get(ind) ?? 0) + 1)
  }
  const present = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (present.length < 2) return []
  // No "All" chip — each tag toggles on/off, so cleared (iFilter === '') just
  // means no chip is highlighted and everything shows.
  return present.map(([ind, count]) => ({ key: ind, label: ind, dotColor: industryTagStyle(ind).color, count }))
})
// Reset the industry filter if the selected industry drops out of the list.
watch(industryTabItems, (items) => {
  if (iFilter.value && !items.some((i) => i.key === iFilter.value)) iFilter.value = ''
})

const filteredCs = computed(() => {
  const q = cSearch.value.toLowerCase()
  let list = contacts.value.filter(
    (c) =>
      !c.hibernated &&
      (c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)) &&
      (!cFilter.value || c.rating === cFilter.value) &&
      (!iFilter.value || (c as any).industry === iFilter.value)
  )
  if (cSort.value === 'hot')
    list = [...list].sort((a, b) => (RATING_ORDER[a.rating ?? ''] ?? 4) - (RATING_ORDER[b.rating ?? ''] ?? 4))
  if (cSort.value === 'name')
    list = [...list].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  // Pinned contacts always float to the top, keeping their relative order.
  list = [...list].sort((a, b) => Number((b as any).pinned ?? false) - Number((a as any).pinned ?? false))
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

      <!-- Tabs row: sub-tab (My Deck | Orbit) on the left, and the deck's
           view-mode toggle (List | Pipeline) pinned to the right on the SAME
           row. The view toggle only makes sense for the deck, so it's hidden
           on Orbit.
             My Deck = cards you've collected (rolodex); Orbit = user↔user
             connections. viewMode key stays 'rating' to avoid churning the
             existing checks; only the label reads "List". -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px">
        <CdTabs
          v-model="netTab"
          :items="[
            { key: 'contacts', label: 'My Deck', emoji: '🃏', icon: 'lucide:credit-card' },
            { key: 'connections', label: 'Orbit', emoji: '🪐', icon: 'lucide:orbit', count: incoming.length || null },
          ]"
        />
        <CdTabs
          v-if="netTab === 'contacts'"
          v-model="viewMode"
          size="sm"
          :items="[
            { key: 'rating', label: 'List', emoji: '📋', icon: 'lucide:list' },
            { key: 'pipeline', label: 'Pipeline', emoji: '📊', icon: 'lucide:git-branch' },
          ]"
        />
      </div>

      <template v-if="netTab === 'contacts'">
        <input v-model="cSearch" class="cd-inp" placeholder="Search..." style="margin-bottom: 10px" />

        <!-- Rating filter (only in rating mode) -->
        <div v-if="viewMode === 'rating'" class="cd-hscroll" style="padding-bottom: 2px">
          <CdTabs v-model="cFilter" :items="ratingTabItems" size="sm" />
        </div>

        <!-- Industry filter (only in rating mode, and only when there's more than
             one industry to choose from) -->
        <div v-if="viewMode === 'rating' && industryTabItems.length" class="cd-hscroll" style="padding-bottom: 2px; margin-top: 6px">
          <CdTabs v-model="iFilter" :items="industryTabItems" size="sm" toggle />
        </div>
      </template>
    </div>

    <!-- Main content switches between Orbit / List / Pipeline — crossfade so the
         swap doesn't hard-cut. out-in: the old view fades out before the new one
         fades in (heights differ, so a simultaneous fade would overlap). -->
    <Transition name="cd-view" mode="out-in">
      <!-- Connections sub-tab -->
      <ConnectionsView v-if="netTab === 'connections'" key="orbit" />

      <!-- Rating view -->
      <div v-else-if="viewMode === 'rating'" key="list" class="cd-scrl" style="padding: 4px var(--cd-gutter) 8px">
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
      <TransitionGroup tag="div" class="cd-card-list" name="cd-card">
      <div
        v-for="c in filteredCs"
        :key="c.id"
        class="cd-crd cd-net-card"
        :class="{ 'cd-row-sel': selectMode && selectedIds.has(c.id), 'is-open': peeked.has(c.id) }"
      >
        <div
          class="cd-net-head"
          @click="selectMode ? toggleSelect(c.id) : goDetail(c.id)"
        >
          <div v-if="selectMode" class="cd-selck" :class="{ on: selectedIds.has(c.id) }">
            <CdIcon v-if="selectedIds.has(c.id)" emoji="✓" icon="lucide:check" :size="13" />
          </div>
          <!-- Shared avatar: perfect circle, industry glyph/ring, initials fallback. -->
          <CdAvatar
            :src="(c as any).imageUrl || null"
            :name="c.name"
            :industry="(c as any).industry"
            :size="38"
            ring
          />
          <div style="flex: 1; min-width: 0">
            <div class="cd-cnm">{{ c.name }}</div>
            <div class="cd-csb">{{ [c.title, c.company].filter(Boolean).join(' · ') }}</div>
            <div v-if="(c as any).objective" class="cd-cobj" :title="(c as any).objective">
              <CdIcon emoji="🎯" icon="lucide:target" :size="10" /> {{ (c as any).objective }}
            </div>
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
            <button v-else-if="(c as any).opportunity_goal === 'partner'" type="button" class="cd-mpill" style="color: #7f77dd; border-color: rgba(127,119,221,0.4); background: rgba(127,119,221,0.08); border-style: dashed; cursor: pointer; font-family: inherit" @click.stop="goalFor = c"><CdIcon emoji="🤝" icon="lucide:handshake" :size="9" /> pursuing partner</button>
            <button v-else-if="(c as any).opportunity_goal === 'client'" type="button" class="cd-mpill" style="color: #4da6ff; border-color: rgba(77,166,255,0.4); background: rgba(77,166,255,0.08); border-style: dashed; cursor: pointer; font-family: inherit" @click.stop="goalFor = c"><CdIcon emoji="💼" icon="lucide:briefcase" :size="9" /> pursuing client</button>
            <span v-if="c.linked_user" class="cd-mpill" style="color: var(--cd-purple, #b87dff); border-color: rgba(184,125,255,0.3); background: rgba(184,125,255,0.1)"><CdIcon emoji="🪐" icon="lucide:orbit" :size="9" /> joined</span>
            <span v-if="planContactIds.has(c.id)" class="cd-mpill" style="color: var(--cd-accent); border-color: rgba(0,255,135,0.3); background: rgba(0,255,135,0.09)" title="Has an active plan"><CdIcon emoji="📋" icon="lucide:list-checks" :size="9" /> plan</span>
          </div>
          <!-- Right-edge toolbar: pin + expand stacked vertically, set off from
               the card body by a subtle left border with a divider between them. -->
          <div v-if="!selectMode" class="cd-card-tools">
            <!-- Pin toggle: floats this contact to the top of the list (red when pinned). -->
            <button
              type="button"
              class="cd-pin-tog"
              :class="{ on: (c as any).pinned }"
              :aria-label="(c as any).pinned ? 'Unpin contact' : 'Pin contact to top'"
              :aria-pressed="(c as any).pinned || false"
              :title="(c as any).pinned ? 'Pinned — tap to unpin' : 'Pin to top'"
              @click.stop="togglePinned(c)"
            >
              <CdIcon emoji="📌" icon="lucide:pin" mode="svg" :size="15" />
            </button>
            <!-- Peek toggle: reveals the last touchpoint inline without leaving the list. -->
            <button
              type="button"
              class="cd-peek-tog"
              :class="{ on: peeked.has(c.id) }"
              :aria-label="peeked.has(c.id) ? 'Hide last touchpoint' : 'Show last touchpoint'"
              :aria-expanded="peeked.has(c.id)"
              title="Last touchpoint"
              @click.stop="togglePeek(c.id)"
            >
              <CdIcon emoji="🕓" icon="lucide:chevron-down" :size="16" />
            </button>
          </div>
        </div>
        <Transition name="cd-expand">
          <div v-if="peeked.has(c.id)" class="cd-peek-wrap" @click.stop>
          <div class="cd-peek">
            <!-- Mirrors the detail-screen timeline entry: colored type dot on the
                 left (with a fading line hinting at older history) + an indented
                 touchpoint card on the right. -->
            <div v-if="lastMeaningfulActivity(c)" class="cd-peek-tl">
              <div v-if="(c.activities?.length || 0) > 1" class="cd-peek-line"></div>
              <div class="cd-tl-dot" :class="lastMeaningfulActivity(c)!.type">
                <CdIcon :emoji="getAct(lastMeaningfulActivity(c)!.type).icon" :icon="getAct(lastMeaningfulActivity(c)!.type).lucide" :size="17" />
              </div>
              <div class="cd-peek-card">
                <div class="cd-peek-card-top">
                  <div class="cd-peek-card-label">{{ lastMeaningfulActivity(c)!.label || getAct(lastMeaningfulActivity(c)!.type).label }}</div>
                  <div class="cd-peek-when" :title="fmtFull(lastMeaningfulActivity(c)!.date)">
                    <span class="cd-peek-rel">{{ fmtRelative(lastMeaningfulActivity(c)!.date) }}</span>
                    <span class="cd-peek-abs">{{ fmtFull(lastMeaningfulActivity(c)!.date) }}</span>
                  </div>
                </div>
                <div v-if="lastMeaningfulActivity(c)!.note" class="cd-peek-card-note">{{ lastMeaningfulActivity(c)!.note }}</div>
              </div>
            </div>
            <div v-else class="cd-peek-tl">
              <div class="cd-tl-dot other"><CdIcon emoji="👋" icon="lucide:hand" :size="16" /></div>
              <div class="cd-peek-card">
                <div class="cd-peek-card-note">No touchpoints logged yet.</div>
              </div>
            </div>
            <button type="button" class="cd-peek-more" @click.stop="goDetail(c.id)">
              {{ lastActivity(c) ? 'View full history' : 'Log the first one' }} <CdIcon icon="lucide:arrow-right" :size="11" />
            </button>
          </div>
          </div>
        </Transition>
      </div>
      </TransitionGroup>
      </div>

      <CdBrandFooter />
    </div>

      <!-- Pipeline view — kanban board; columns fill the container, drag a card to change its stage -->
      <div v-else key="pipeline" class="cd-scrl" style="padding: 4px var(--cd-gutter) 8px">
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
          <TransitionGroup tag="div" class="cd-card-list" name="cd-card">
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
              <span v-if="(c as any).opportunity_goal === 'partner'" style="font-size: 13px" aria-label="Pursuing as partner"><CdIcon emoji="🤝" icon="lucide:handshake" :size="12" /></span>
              <span v-else-if="(c as any).opportunity_goal === 'client'" style="font-size: 13px" aria-label="Pursuing as client"><CdIcon emoji="💼" icon="lucide:briefcase" :size="12" /></span>
              <span v-if="c.estimated_value" style="font-size: 9px; font-weight: 700; color: var(--cd-accent)">
                ${{ c.estimated_value.toLocaleString() }}
              </span>
            </div>
          </div>
          </TransitionGroup>
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
    </Transition>

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
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">Pursuing as…</div>
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
