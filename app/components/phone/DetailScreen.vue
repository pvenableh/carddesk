<script setup lang="ts">
import { RATINGS, ACT_TYPES, INDUSTRIES, getRating, getAct, cEmoji, industryTagStyle } from '~/composables/useConstants'
import { todayStr, fmtFull } from '~/composables/useFormatters'
import { PIPELINE_STAGES, LOST_REASONS, GOAL_OPTIONS, CONVERSION_REASONS } from '~/composables/usePipeline'
import { SOCIALS, SOCIAL_KEYS, socialUrl } from '~/types/socials'
import { cleanPhones } from '~/types/contact'
import type { PipelineStage, OpportunityGoal } from '~/types/directus'
import confettiLib from 'canvas-confetti'

const { contacts, updateContact, uploadContactImage, removeContactImage, hibernate, logActivity, markResponded, updateActivity, deleteActivity, lastActivity, daysSince, followUpStatus, fetchContacts } = useContacts()
const { state: xp, earn, deduct, completeMission } = useXp()
const { success, error: showError } = useToast()
const { selectedId, editing, nav } = useNavigation()

// ── Contact photo upload (downscaled client-side, filed in Contact Photos) ──
// Three sources, device-appropriate: camera (capture), photo library, and a
// generic file picker. On touch devices we present a small menu; on desktop
// (no camera/library distinction) tapping goes straight to the file dialog.
const camInputEl = ref<HTMLInputElement | null>(null)
const libInputEl = ref<HTMLInputElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
const photoMenuOpen = ref(false)
const isCoarse = ref(false)
onMounted(() => { isCoarse.value = window.matchMedia?.('(pointer: coarse)').matches ?? false })

function openPhotoPicker() {
  if (photoUploading.value) return
  // Always offer the source menu; the camera option is gated to touch devices
  // (where capture actually opens a camera) — see the v-if on "Take a photo".
  photoMenuOpen.value = true
}
function pickPhoto(kind: 'cam' | 'lib' | 'file' | 'remove') {
  photoMenuOpen.value = false
  if (kind === 'cam') camInputEl.value?.click()
  else if (kind === 'lib') libInputEl.value?.click()
  else if (kind === 'file') fileInputEl.value?.click()
  else if (kind === 'remove') onRemovePhoto()
}

const photoUploading = ref(false)
async function onContactPhoto(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  const c = selContact.value as any
  if (!f || !c) return
  if (!f.type.startsWith('image/')) {
    showError('Please choose an image file.')
    input.value = ''
    return
  }
  photoUploading.value = true
  try {
    await uploadContactImage(c.id, f)
    success('Photo updated')
  } catch (err: any) {
    console.error('[DetailScreen] contact photo upload failed:', err?.data?.message ?? err)
    showError(err?.data?.message || 'Couldn\'t upload that photo — try again.')
  } finally {
    photoUploading.value = false
    input.value = ''
  }
}
async function onRemovePhoto() {
  const c = selContact.value as any
  if (!c?.id || photoUploading.value) return
  photoUploading.value = true
  try {
    await removeContactImage(c.id)
    success('Photo removed')
  } catch (err: any) {
    console.error('[DetailScreen] remove contact photo failed:', err?.data?.message ?? err)
    showError('Couldn\'t remove the photo — try again.')
  } finally {
    photoUploading.value = false
  }
}
const { profile } = useProfile()
const { moveToStage, setOpportunityGoal, setGoalTag, graduate, revertGraduation, getStageInfo } = usePipeline()

const selContact = computed(() => contacts.value.find((c) => c.id === selectedId.value) ?? null)

// Pipeline stage management
const showStageSheet = ref(false)
const showLostReasonSheet = ref(false)
const selectedLostReason = ref('')

// Goal picker (shown when entering the Opportunity stage) and the unified
// Graduate sheet (replaces the old "Mark as Client" confirm).
const showGoalSheet = ref(false)
const showGraduateSheet = ref(false)
const graduateGoal = ref<OpportunityGoal>('client')
const selectedConversionReason = ref('')
const conversionNote = ref('')
const estimatedValue = ref<number | null>(null)

// Earnest hand-off, opened after a successful graduation.
const showEarnestHandoff = ref(false)

// Optional goal tag — "what am I going for with this contact" — independent of stage.
const showGoalTagSheet = ref(false)
const goalInfo = computed(() => GOAL_OPTIONS.find((g) => g.key === (selContact.value as any)?.opportunity_goal) ?? null)
async function doSetGoalTag(goal: OpportunityGoal | null) {
  if (selContact.value) await setGoalTag(selContact.value.id, goal)
  showGoalTagSheet.value = false
}

// Free-text objective — the specific win to chase with this contact. Quick-edit
// via its own sheet (mirrors the goal tag) so it's one tap from the hero.
const showObjectiveSheet = ref(false)
const objectiveDraft = ref('')
function openObjectiveSheet() {
  objectiveDraft.value = (selContact.value as any)?.objective ?? ''
  showObjectiveSheet.value = true
}
async function doSaveObjective() {
  if (!selContact.value) return
  const next = objectiveDraft.value.trim()
  await updateContact(selContact.value.id, { objective: next || null } as any)
  showObjectiveSheet.value = false
}

// Active plans + open tasks for this contact, kept loaded so the Ask Earnest
// context (contactContext) can hand them to Earnest. Refreshes when the open
// card changes or any plan/task mutates (usePlans `dirty`).
const { listPlans: listContactPlans, listTasks: listContactTasks, dirty: plansDirty } = usePlans()
const contactPlans = ref<{ title: string; open_tasks: { title: string; due_at: string | null }[] }[]>([])
async function loadContactPlans() {
  const c = selContact.value as any
  if (!c?.id) { contactPlans.value = []; return }
  try {
    const [plans, tasks] = await Promise.all([
      listContactPlans({ contact: c.id, status: 'active' }),
      listContactTasks({ contact: c.id, status: 'pending' }),
    ])
    contactPlans.value = plans.map((p: any) => ({
      title: p.title,
      open_tasks: tasks
        .filter((t: any) => t.plan === p.id)
        .map((t: any) => ({ title: t.title, due_at: t.due_at ?? null })),
    }))
  } catch {
    contactPlans.value = []
  }
}
watch(() => (selContact.value as any)?.id, loadContactPlans, { immediate: true })
watch(plansDirty, loadContactPlans)

// Industry — a live tag in the hero; tap to change from a picker (mirrors the
// rating / pursuing pickers), so it doesn't require opening the full edit form.
const showIndustrySheet = ref(false)
async function doSetIndustry(ind: string | null) {
  if (selContact.value) await updateContact(selContact.value.id, { industry: ind || null } as any)
  showIndustrySheet.value = false
}

// Move to a plain forward step, or branch to the goal/lost sub-sheets.
async function doMoveStage(stage: PipelineStage) {
  if (!selContact.value) return
  if (stage === 'lost') {
    showStageSheet.value = false
    showLostReasonSheet.value = true
    return
  }
  if (stage === 'opportunity') {
    showStageSheet.value = false
    showGoalSheet.value = true
    return
  }
  await moveToStage(selContact.value.id, stage, {})
  showStageSheet.value = false
}

// Pick the goal at the Opportunity stage (client vs partner).
async function doPickGoal(goal: OpportunityGoal) {
  if (!selContact.value) return
  await setOpportunityGoal(selContact.value.id, goal)
  showGoalSheet.value = false
}

// Open the Graduate sheet, pre-seeded with the existing goal/value.
function openGraduate() {
  const c = selContact.value as any
  if (!c) return
  graduateGoal.value = (c.opportunity_goal as OpportunityGoal) || 'client'
  selectedConversionReason.value = c.conversion_reason || ''
  conversionNote.value = c.conversion_note || ''
  estimatedValue.value = c.estimated_value ?? null
  showGraduateSheet.value = true
}

async function doGraduate() {
  if (!selContact.value) return
  await graduate(selContact.value.id, graduateGoal.value, {
    reason: selectedConversionReason.value || undefined,
    note: conversionNote.value.trim() || undefined,
    estimated_value: estimatedValue.value ?? undefined,
  })
  showGraduateSheet.value = false
  fireConfetti()
  showEarnestHandoff.value = true
}

async function doLogLostReason() {
  if (!selContact.value) return
  await moveToStage(selContact.value.id, 'lost', { lost_reason: selectedLostReason.value || 'Other' })
  showLostReasonSheet.value = false
  selectedLostReason.value = ''
}

const editForm = ref<Record<string, any>>({})
const actType = ref('email')
const actNote = ref('')
const actDate = ref(todayStr())

// Edit form: socials live behind a pill toggle (matching the add-contact form).
const showEditSocials = ref(false)
const editSocialCount = computed(() => SOCIAL_KEYS.filter((k) => editForm.value[k]).length)

// Open-task count from the Plans widget, surfaced on the "Plan" coach tab.
const planCount = ref(0)

const sortedActs = computed(() => {
  if (!selContact.value?.activities?.length) return []
  return [...(selContact.value.activities as any[])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
})

function fuInfo(c: any) {
  const s = followUpStatus(c)
  const la = lastActivity(c) as any
  const d = daysSince(c)
  return {
    overdue: { ico: '⚡', lucide: 'lucide:alert-triangle', cls: 'overdue', title: `${d} days overdue`, sub: `Last: ${la?.label ?? 'Contact'} on ${fmtFull(la?.date)}` },
    due: { ico: '⏰', lucide: 'lucide:clock', cls: 'due', title: `${d} days — right on the line`, sub: 'A quick touch now resets the clock.' },
    ok: { ico: '✓', lucide: 'lucide:check', cls: 'ok', title: "You're on top of this one", sub: `Last: ${la?.label ?? 'Contact'} on ${fmtFull(la?.date)}` },
    new: { ico: '👋', lucide: 'lucide:hand', cls: 'new', title: 'No activity yet', sub: 'Log your first touchpoint below.' },
  }[s]
}

function fireConfetti() {
  confettiLib({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#00ff87', '#ffd700', '#ff6b35', '#4da6ff', '#b87dff'] })
}

// Directional transition between the detail view and its edit form: opening the
// editor pushes left (iOS deeper); cancel/save pops right (iOS back).
const editTransition = ref<'cd-slide-left' | 'cd-slide-right'>('cd-slide-left')

function startEdit() {
  const c = selContact.value as any
  if (!c) return
  editTransition.value = 'cd-slide-left'
  editForm.value = {
    name: c.name, title: c.title, company: c.company,
    email: c.email, phone: c.phone,
    // Clone so editing the rows doesn't mutate the cached contact in place.
    phones: Array.isArray(c.phones) ? c.phones.map((p: any) => ({ ...p })) : [],
    website: c.website, industry: c.industry,
    met_at: c.met_at, location: c.location, address: c.address, rating: c.rating,
    objective: c.objective, notes: c.notes,
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, c[k]])),
  }
  // Start expanded only if there's already a handle to show.
  showEditSocials.value = SOCIAL_KEYS.some((k) => c[k])
  editing.value = true
}

/** The platforms this contact has a handle for (for the follow buttons). */
function contactSocials(c: any) {
  return SOCIALS.filter((s) => c?.[s.key])
}

/** Additional (non-primary) phone numbers, blanks filtered out. */
function extraPhones(c: any) {
  return Array.isArray(c?.phones) ? c.phones.filter((p: any) => p?.value) : []
}

/** Turn a bare website into a clickable absolute URL. */
function websiteHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

async function doSaveEdit() {
  if (!selContact.value) return
  // Strip blank phone rows so we don't persist empty entries.
  const patch = { ...editForm.value, phones: cleanPhones(editForm.value.phones) }
  await updateContact((selContact.value as any).id, patch)
  editTransition.value = 'cd-slide-right'
  editing.value = false
}

function cancelEdit() {
  editTransition.value = 'cd-slide-right'
  editing.value = false
}

async function doLogAct(isResp: boolean) {
  if (!selContact.value) return
  const c = selContact.value as any
  await logActivity({
    contact: c.id,
    type: actType.value,
    label: getAct(actType.value).label,
    date: actDate.value || todayStr(),
    note: actNote.value,
    is_response: isResp,
  })
  actNote.value = ''
  actDate.value = todayStr()
  if (isResp) {
    const extras = c.rating === 'hot' ? { hot_responses: (xp.value.hot_responses ?? 0) + 1 } : {}
    earn(100, '🎉', 'They came back. Of course they did.', extras)
    fireConfetti()
    completeMission('response')
  } else {
    c.rating === 'hot'
      ? earn(50, '⚡', "Don't leave them hanging.")
      : earn(25, '✉️', "They'll remember you.")
    completeMission('followup')
    if (c.rating === 'hot') completeMission('hot')
  }
  // Reconcile with the server once the optimistic row is in place: picks up the
  // auto-warm stage move, the true date_created ordering, and anything else the
  // write derived. Silent + fire-and-forget so the XP/confetti stay instant.
  fetchContacts({ silent: true }).catch(() => {})
}

async function doMarkResponded(actId: string) {
  if (!selContact.value) return
  const c = selContact.value as any
  await markResponded(c.id, actId)
  earn(100, '🎉', 'They replied!', { hot_responses: (xp.value.hot_responses ?? 0) + 1 })
  fireConfetti()
  completeMission('response')
}

async function doHibernate(id: string) {
  await hibernate(id)
  nav('contacts')
}

// Quick temperature set — inline on the detail page, no edit mode needed.
// Tapping the active rating again clears it. Persists immediately.
async function quickSetRating(key: string) {
  if (!selContact.value) return
  const c = selContact.value as any
  const next = c.rating === key ? null : key
  await updateContact(c.id, { rating: next } as any)
}

// Undo a graduation — drops the client/partner status, parks back at Opportunity,
// backs out the XP. Forgiving on purpose: graduating is the deliberate step.
async function doRevertGraduation() {
  if (!selContact.value) return
  const c = selContact.value as any
  if (!c.is_client && !c.is_partner) return
  await revertGraduation(c.id)
}

// Share contact — sends a real vCard (.vcf) through the system share sheet so
// iPhone offers "Add to Contacts"; falls back to a .vcf download elsewhere.
const { shareContact: shareContactVCard } = useShare()
const shareCopied = ref(false)
async function shareContact() {
  const c = selContact.value as any
  if (!c) return
  const result = await shareContactVCard({
    name: c.name,
    first_name: c.first_name,
    last_name: c.last_name,
    title: c.title,
    company: c.company,
    email: c.email,
    phone: c.phone,
    phones: c.phones,
    website: c.website,
    notes: c.notes,
  })
  if (result === 'downloaded') {
    shareCopied.value = true
    setTimeout(() => (shareCopied.value = false), 2000)
  }
}

// Activity edit/delete
const editingActId = ref<string | null>(null)
const editActForm = ref<{ type: string; note: string; date: string }>({ type: '', note: '', date: '' })
const confirmDeleteId = ref<string | null>(null)

function startEditAct(act: any) {
  editingActId.value = act.id
  editActForm.value = { type: act.type, note: act.note ?? '', date: act.date }
}

function cancelEditAct() {
  editingActId.value = null
}

async function doSaveAct() {
  if (!selContact.value || !editingActId.value) return
  const c = selContact.value as any
  await updateActivity(c.id, editingActId.value, {
    type: editActForm.value.type,
    label: getAct(editActForm.value.type).label,
    note: editActForm.value.note || undefined,
    date: editActForm.value.date,
  } as any)
  editingActId.value = null
}

function xpForActivity(act: any): number {
  if (act.type === 'converted_client' || act.type === 'converted_partner') return 200
  if (act.type === 'stage_change') return 0
  if (act.is_response) return 100
  const c = selContact.value as any
  if (c?.rating === 'hot') return 50
  return 25
}

async function doDeleteAct(act: any) {
  if (!selContact.value) return
  const c = selContact.value as any
  const amount = xpForActivity(act)
  await deleteActivity(c.id, act.id)
  deduct(amount, '🗑️', 'Activity removed.')
  confirmDeleteId.value = null
}

// AI suggestions
const suggestions = ref<Array<{ icon: string; title: string; body: string }>>([])
const sugLoading = ref(false)
const sugError = ref<string | null>(null)

const analytics = useAnalytics()
async function loadSuggestions() {
  if (!selContact.value) return
  const c = selContact.value as any
  sugLoading.value = true; sugError.value = null; suggestions.value = []
  analytics.aiFeatureUse('suggestions')
  try {
    const data = await $fetch<Array<{ icon: string; title: string; body: string }>>('/api/ai-suggestions', {
      method: 'POST',
      body: {
        contact: {
          name: c.name, title: c.title, company: c.company, industry: c.industry,
          location: c.location, rating: c.rating, notes: c.notes,
          pipeline_stage: c.pipeline_stage, opportunity_goal: c.opportunity_goal,
          objective: c.objective, estimated_value: c.estimated_value,
        },
        activities: sortedActs.value.slice(0, 10).map((a: any) => ({ date: a.date, label: a.label, note: a.note, is_response: a.is_response })),
        daysSinceLastActivity: daysSince(c),
        activePlans: contactPlans.value,
        profile: profile.value,
      },
    })
    suggestions.value = data
    completeMission('ai_ideas')
  } catch { sugError.value = 'Could not load suggestions' }
  finally { sugLoading.value = false }
}

// Saved AI history for this contact (client-specific sessions + feedback)
const { saveSession, listSessions, deleteSession, sendFeedback } = useSessions()
const { claimRewards } = useCredits()
const aiHistory = ref<any[]>([])
const historyLoading = ref(false)
const expandedSession = ref<string | null>(null)
const historySearch = ref('')
const filteredHistory = computed(() => {
  const term = historySearch.value.trim().toLowerCase()
  if (!term) return aiHistory.value
  return aiHistory.value.filter((s) => {
    const text = [s.title, s.type, ...sessionLines(s).map((l) => `${l.title} ${l.body}`)].join(' ').toLowerCase()
    return text.includes(term)
  })
})
const sugSaved = ref(false)

// Earnest coach widget — three views (ideas / plan / saved history) collapsed
// into one tabbed card so they stop competing for space down the page.
const coachTab = ref<'next' | 'plan' | 'history'>('next')

// Shorten the coach tab labels on phones ("Next steps"→"Next",
// "Earnest AI History"→"AI History") so the three pills don't overflow.
const isMobile = ref(false)
let coachMq: MediaQueryList | null = null
const onCoachMq = (e: MediaQueryList | MediaQueryListEvent) => { isMobile.value = e.matches }
onMounted(() => {
  coachMq = window.matchMedia('(max-width: 767px)')
  isMobile.value = coachMq.matches
  coachMq.addEventListener('change', onCoachMq)
})
onUnmounted(() => coachMq?.removeEventListener('change', onCoachMq))

async function loadHistory() {
  if (!selContact.value) { aiHistory.value = []; return }
  historyLoading.value = true
  try { aiHistory.value = await listSessions({ contact: (selContact.value as any).id }) }
  catch { aiHistory.value = [] }
  finally { historyLoading.value = false }
}
watch(selContact, () => loadHistory(), { immediate: true })

async function saveSuggestions() {
  if (!selContact.value || !suggestions.value.length) return
  const c = selContact.value as any
  try {
    await saveSession({
      type: 'suggestions',
      contact: c.id,
      title: `Next steps — ${c.name}`,
      messages: [{ role: 'assistant', content: suggestions.value, ai_generated: true }],
    })
    sugSaved.value = true
    earn(10, '💾', 'Saved to this contact')
    setTimeout(() => (sugSaved.value = false), 2000)
    await loadHistory()
    claimRewards()
  } catch { /* non-fatal */ }
}

async function rateSession(s: any, rating: 'up' | 'down') {
  s._rated = rating
  if (rating === 'up') fireConfetti()
  try {
    await sendFeedback({ contact: (selContact.value as any)?.id ?? null, session: s.id, rating, source: s.type })
    claimRewards()
  } catch { /* non-fatal */ }
}

async function removeSession(s: any) {
  try { await deleteSession(s.id) } catch { /* non-fatal */ }
  aiHistory.value = aiHistory.value.filter((x) => x.id !== s.id)
}

// ── Earnest AI chat (continuable, contextual) ──
const { open: openChat, resume: resumeChat, isOpen: chatOpen } = useChat()

// When an Earnest conversation closes, reconcile this contact: the just-ended
// chat becomes a new AI-history entry, and it may have spun up a plan/tasks that
// change the "active plan" badge — so refresh history, plans, and contacts.
watch(chatOpen, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen && (selContact.value as any)?.id) {
    loadHistory()
    loadContactPlans()
    fetchContacts({ silent: true }).catch(() => {})
  }
})

function contactContext() {
  const c = selContact.value as any
  if (!c) return null
  return {
    name: c.name, title: c.title, company: c.company, industry: c.industry,
    rating: c.rating, pipeline_stage: c.pipeline_stage, estimated_value: c.estimated_value,
    // opportunity_goal = who we're pursuing them as (client/partner);
    // objective = the specific free-text win to drive toward.
    pursuing_as: c.opportunity_goal ?? null,
    objective: c.objective ?? null,
    met_at: c.met_at, location: c.location, is_client: c.is_client, notes: c.notes,
    days_since_last_activity: daysSince(c),
    // Active plans + their still-open tasks, so Earnest can reference the plan
    // of attack instead of re-proposing steps the user already has.
    active_plans: contactPlans.value,
    recent_activities: sortedActs.value.slice(0, 8).map((a: any) => ({
      date: a.date, label: a.label, note: a.note, is_response: a.is_response,
    })),
  }
}

function contactFocus(): string {
  const c = selContact.value as any
  if (!c) return ''
  return `the contact "${c.name}"${c.company ? ` from ${c.company}` : ''} — their CRM profile (rating, pipeline stage, what they're being pursued as, the objective/win to drive toward, any active plans and open tasks, notes, and full activity history)`
}

// Shared so the in-page button and the floating Ask Earnest button hand Earnest
// the exact same rich context (full activity history included).
function askOptions() {
  const c = selContact.value as any
  if (!c) return null
  return {
    scope: 'contact' as const,
    title: c.name,
    contactId: c.id,
    context: contactContext(),
    focus: contactFocus(),
    intro: `Let's talk about ${c.name}${c.company ? ` at ${c.company}` : ''}. Want help with your next move, a follow-up message, or moving them through your pipeline?`,
  }
}

function askEarnest() {
  const opts = askOptions()
  if (!opts) return
  analytics.aiFeatureUse('chat')
  openChat(opts)
}

// Publish the rich contact context to the floating Ask Earnest button while this
// screen is alive; it reads selContact live, so it always reflects the open card.
const { provideContext, clearContext } = useAskEarnest()
onMounted(() => provideContext('detail', askOptions))
onUnmounted(() => clearContext('detail'))

function continueChat(s: any) {
  resumeChat(s, contactContext(), 'contact', contactFocus())
}

// Normalize a saved session's assistant content into displayable lines.
function sessionLines(s: any): Array<{ title: string; body: string }> {
  const msgs = s.messages || []
  if (s.type === 'chat') {
    return msgs
      .filter((m: any) => m.role === 'user' || m.role === 'assistant')
      .map((m: any) => ({
        title: m.role === 'user' ? 'You' : 'Earnest',
        body: typeof m.content === 'string' ? m.content : '',
      }))
  }
  const msg = msgs.find((m: any) => m.role === 'assistant') || msgs[0]
  const content = msg?.content
  if (!content) return []
  if (Array.isArray(content)) {
    return content.map((x: any) => ({ title: `${x.icon ?? ''} ${x.title ?? ''}`.trim(), body: x.body ?? '' }))
  }
  if (content.cards) {
    return content.cards.map((c: any) => ({ title: c.q ?? '', body: String(c.b ?? '').replace(/<[^>]+>/g, '') }))
  }
  return []
}
</script>

<template>
  <div class="cd-screen on">
    <template v-if="selContact">
      <Transition :name="editTransition" mode="out-in">
        <div v-if="editing" key="edit" class="cd-scrl cd-pad">
          <button class="cd-back" @click="cancelEdit"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Cancel</button>
          <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px">Edit Contact</div>
          <label class="cd-lbl">Name</label><input v-model="editForm.name" class="cd-inp" />
          <!-- Rating up top — it's the primary signal, not a footnote. -->
          <label class="cd-lbl">Rating</label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px">
            <button
              v-for="r in RATINGS"
              :key="r.key"
              class="cd-rpick"
              :style="editForm.rating === r.key ? 'background:' + r.color + '22;border-color:' + r.color + ';color:' + r.color : ''"
              @click="editForm.rating = editForm.rating === r.key ? '' : r.key"
            ><CdIcon :emoji="r.emoji" :icon="r.lucide" :size="12" /> {{ r.label }}</button>
          </div>
          <div class="cd-frow">
            <div><label class="cd-lbl">Title</label><input v-model="editForm.title" class="cd-inp" /></div>
            <div><label class="cd-lbl">Company</label><input v-model="editForm.company" class="cd-inp" /></div>
          </div>
          <label class="cd-lbl">Industry</label>
          <select v-model="editForm.industry" class="cd-inp">
            <option value="">—</option>
            <option v-for="ind in INDUSTRIES" :key="ind" :value="ind">{{ ind }}</option>
          </select>
          <div class="cd-frow">
            <div><label class="cd-lbl">Email</label><input v-model="editForm.email" class="cd-inp" type="email" /></div>
            <div><label class="cd-lbl">Phone <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· primary</span></label><input v-model="editForm.phone" class="cd-inp" type="tel" /></div>
          </div>
          <PhonePhonesField v-model="editForm.phones" />
          <label class="cd-lbl">Website</label>
          <input v-model="editForm.website" class="cd-inp" type="url" placeholder="acme.com" />
          <div class="cd-frow">
            <PhoneMetAtField v-model="editForm.met_at" />
            <div><label class="cd-lbl">Location <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· city / region</span></label><input v-model="editForm.location" class="cd-inp" placeholder="Austin, TX" /></div>
          </div>
          <label class="cd-lbl">Address</label><textarea v-model="editForm.address" class="cd-inp" style="min-height: 48px; resize: vertical"></textarea>

          <!-- Socials tucked behind a pill toggle, matching the add-contact form. -->
          <button
            type="button"
            class="cd-collapse-toggle"
            :aria-expanded="showEditSocials"
            style="margin: 4px 0 8px"
            @click="showEditSocials = !showEditSocials"
          >
            <CdIcon icon="lucide:at-sign" :size="13" />
            Social profiles
            <span v-if="editSocialCount" class="cd-collapse-count">{{ editSocialCount }}</span>
            <CdIcon :icon="showEditSocials ? 'lucide:chevron-up' : 'lucide:chevron-down'" :size="14" style="margin-left: auto" />
          </button>
          <template v-if="showEditSocials">
            <template v-for="s in SOCIALS" :key="s.key">
              <label class="cd-lbl">{{ s.label }}</label><input v-model="editForm[s.key]" class="cd-inp" :placeholder="s.placeholder" />
            </template>
          </template>
          <label class="cd-lbl" style="display: flex; align-items: center; gap: 6px">
            <CdIcon emoji="🎯" icon="lucide:target" :size="12" /> Objective
            <span style="margin-left: auto; font-size: 10px; font-weight: 500; color: var(--cd-dim)">{{ (editForm.objective || '').length }}/80</span>
          </label>
          <input
            v-model="editForm.objective"
            class="cd-inp"
            maxlength="80"
            placeholder="e.g. Sign a small-business design package"
          />
          <label class="cd-lbl">Notes</label>
          <textarea v-model="editForm.notes" class="cd-inp" style="min-height: 60px; resize: vertical"></textarea>
          <button class="cd-abtn g" style="margin-top: 4px" @click="doSaveEdit">Save Changes</button>
        </div>
        <div v-else key="view" class="cd-scrl cd-pad">
          <button class="cd-back" @click="nav('contacts')"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Back</button>
          <div class="cd-det-hero">
            <div style="display: flex; align-items: center; gap: 11px; margin-bottom: 10px">
              <div class="cd-det-av-wrap">
                <button class="cd-det-av cd-det-av-btn" type="button" :disabled="photoUploading" :title="(selContact as any).imageUrl ? 'Change photo' : 'Add a photo'" @click="openPhotoPicker">
                  <img v-if="(selContact as any).imageUrl" :src="(selContact as any).imageUrl" alt="" />
                  <CdIcon v-else :emoji="cEmoji(selContact)" icon="lucide:user" :size="24" />
                  <span class="cd-det-av-cam"><CdIcon :icon="photoUploading ? 'lucide:loader-circle' : 'lucide:camera'" :size="11" /></span>
                </button>
                <button v-if="(selContact as any).imageUrl" class="cd-det-av-rm" type="button" :disabled="photoUploading" title="Remove photo" aria-label="Remove photo" @click="onRemovePhoto">
                  <CdIcon icon="lucide:x" :size="11" />
                </button>
                <!-- Photo-source picker as a bottom sheet, teleported to <body> so it
                     can't be clipped/stacked under the glass cards below the hero. -->
                <Teleport to="body">
                  <div v-if="photoMenuOpen" class="cd-ph-backdrop" @click="photoMenuOpen = false"></div>
                  <div v-if="photoMenuOpen" class="cd-ph-menu" role="menu">
                    <div class="cd-ph-title">{{ (selContact as any).imageUrl ? 'Change photo' : 'Add a photo' }}</div>
                    <button v-if="isCoarse" type="button" @click="pickPhoto('cam')"><CdIcon icon="lucide:camera" :size="16" /> Take a photo</button>
                    <button type="button" @click="pickPhoto('lib')"><CdIcon icon="lucide:image" :size="16" /> Photo library</button>
                    <button type="button" @click="pickPhoto('file')"><CdIcon icon="lucide:folder" :size="16" /> Browse files</button>
                    <button v-if="(selContact as any).imageUrl" type="button" class="rm" @click="pickPhoto('remove')"><CdIcon icon="lucide:trash-2" :size="16" /> Remove photo</button>
                    <button type="button" class="cd-ph-cancel" @click="photoMenuOpen = false">Cancel</button>
                  </div>
                </Teleport>
              </div>
              <input ref="camInputEl" type="file" accept="image/*" capture="environment" hidden @change="onContactPhoto" />
              <input ref="libInputEl" type="file" accept="image/*" hidden @change="onContactPhoto" />
              <input ref="fileInputEl" type="file" hidden @change="onContactPhoto" />
              <div class="cd-det-id">
                <!-- Name doubles as the edit trigger; a pencil sits to its right
                     (hover-revealed on pointer-fine screens, always shown on touch).
                     The footer Edit button stays as the explicit fallback. -->
                <div class="cd-det-name-row">
                  <button type="button" class="cd-det-name" title="Edit contact" @click="startEdit">{{ selContact.name }}</button>
                  <button type="button" class="cd-det-name-pen" tabindex="-1" aria-hidden="true" @click="startEdit"><CdIcon icon="lucide:pencil" :size="13" /></button>
                </div>
                <div style="font-size: 12px; color: var(--cd-muted)">
                  {{ [(selContact as any).title, (selContact as any).company].filter(Boolean).join(' · ') }}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap">
              <span v-if="selContact.rating" class="cd-rpill" :class="selContact.rating">
                <CdIcon :emoji="getRating(selContact.rating)?.emoji ?? ''" :icon="getRating(selContact.rating)?.lucide" :size="10" /> {{ getRating(selContact.rating)?.label }}
              </span>
              <button v-if="(selContact as any).is_client" type="button" title="Tap to revert to an active contact" style="background: rgba(0,255,135,0.12); border: 1px solid rgba(0,255,135,0.3); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: var(--cd-green); cursor: pointer; font-family: inherit" @click="doRevertGraduation">
                <CdIcon emoji="💰" icon="lucide:badge-check" :size="10" /> Client
              </button>
              <button v-else-if="(selContact as any).is_partner" type="button" title="Tap to revert to an active contact" style="background: rgba(127,119,221,0.14); border: 1px solid rgba(127,119,221,0.35); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: #7f77dd; cursor: pointer; font-family: inherit" @click="doRevertGraduation">
                <CdIcon emoji="🤝" icon="lucide:handshake" :size="10" /> Partner
              </button>
              <button
                v-if="selContact.pipeline_stage"
                class="cd-rpill"
                style="cursor: pointer; background: rgba(77,166,255,0.1); border-color: rgba(77,166,255,0.3); color: #4da6ff"
                @click="showStageSheet = true"
              >
                <CdIcon :emoji="getStageInfo(selContact.pipeline_stage)?.emoji ?? '📊'" :icon="getStageInfo(selContact.pipeline_stage)?.lucide" :size="10" />
                {{ getStageInfo(selContact.pipeline_stage)?.label }}
              </button>
              <button
                v-else
                style="font-size: 9px; font-weight: 700; color: var(--cd-dim); background: none; border: 1px dashed var(--cd-bdr); border-radius: 6px; padding: 2px 8px; cursor: pointer"
                @click="showStageSheet = true"
              >+ Pipeline</button>
              <!-- Optional goal tag — pill, shown once a goal is set, until graduated. -->
              <CdTooltip
                v-if="goalInfo && !(selContact as any).is_client && !(selContact as any).is_partner"
                :label="`Pursuing as ${goalInfo.label} — tap to change`"
                placement="bottom"
              >
                <button
                  type="button"
                  class="cd-rpill"
                  style="cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 3px"
                  :style="goalInfo.key === 'partner' ? 'color: #7f77dd; border-color: rgba(127,119,221,0.4); background: rgba(127,119,221,0.12)' : 'color: #4da6ff; border-color: rgba(77,166,255,0.4); background: rgba(77,166,255,0.1)'"
                  @click="showGoalTagSheet = true"
                >
                  <CdIcon :emoji="goalInfo.emoji" :icon="goalInfo.lucide" :size="10" /> Pursuing {{ goalInfo.label.toLowerCase() }}
                </button>
              </CdTooltip>
              <CdTooltip
                v-else-if="!(selContact as any).is_client && !(selContact as any).is_partner"
                label="Tag whether you're pursuing them as a client or partner"
                placement="bottom"
              >
                <button
                  type="button"
                  class="cd-rpill"
                  style="cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 3px; color: var(--cd-dim); border-style: dashed; border-color: var(--cd-bdr); background: none"
                  @click="showGoalTagSheet = true"
                ><CdIcon emoji="🧭" icon="lucide:compass" :size="9" /> Pursuing?</button>
              </CdTooltip>
              <button
                v-if="(selContact as any).industry"
                type="button"
                class="cd-tag-ind"
                style="cursor: pointer; font-family: inherit"
                :style="industryTagStyle((selContact as any).industry)"
                title="Tap to change industry"
                @click="showIndustrySheet = true"
              >{{ (selContact as any).industry }}</button>
              <button
                v-else
                type="button"
                class="cd-tag-ind"
                style="cursor: pointer; font-family: inherit; border-style: dashed; color: var(--cd-dim); background: none"
                title="Set industry"
                @click="showIndustrySheet = true"
              ><CdIcon emoji="🏷️" icon="lucide:tag" :size="9" /> Industry</button>
              <span v-if="(selContact as any).location" class="cd-tag-ind"><CdIcon emoji="📍" icon="lucide:map-pin" :size="9" /> {{ (selContact as any).location }}</span>
              <span v-if="(selContact as any).met_at" class="cd-tag-ind">@ {{ (selContact as any).met_at }}</span>
              <!-- Who introduced this contact — settable inline, lives among the hero tags. -->
              <PhoneContactReferral :contact="(selContact as any)" placement="header" />
            </div>
          </div>

          <!-- Free-text objective — the specific win to chase. Tap to set/edit. -->
          <button
            type="button"
            class="cd-obj-banner"
            :class="{ empty: !(selContact as any).objective }"
            @click="openObjectiveSheet"
          >
            <CdIcon emoji="🎯" icon="lucide:target" :size="14" />
            <span v-if="(selContact as any).objective" class="cd-obj-txt">{{ (selContact as any).objective }}</span>
            <span v-else class="cd-obj-txt cd-obj-empty">Set an objective for {{ (selContact as any).name?.split(' ')[0] || 'this contact' }}</span>
            <CdIcon icon="lucide:pencil" :size="12" style="margin-left: auto; opacity: 0.6" />
          </button>

          <div class="cd-fu-banner" :class="followUpStatus(selContact)">
            <span style="font-size: 20px; flex-shrink: 0"><CdIcon :emoji="fuInfo(selContact)?.ico ?? ''" :icon="fuInfo(selContact)?.lucide" :size="20" /></span>
            <div>
              <div class="cd-fu-t">{{ fuInfo(selContact)?.title }}</div>
              <div class="cd-fu-s">{{ fuInfo(selContact)?.sub }}</div>
            </div>
          </div>

          <!-- Quick temperature set — tap to rate without opening edit mode. -->
          <div style="display: flex; gap: 6px; margin-bottom: 14px">
            <button
              v-for="r in RATINGS"
              :key="r.key"
              type="button"
              style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg2); color: var(--cd-muted); font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.12s"
              :style="(selContact as any).rating === r.key ? 'background:' + r.color + '22;border-color:' + r.color + ';color:' + r.color : ''"
              @click="quickSetRating(r.key)"
            ><CdIcon :emoji="r.emoji" :icon="r.lucide" :size="13" /> {{ r.label }}</button>
          </div>

          <div v-if="(selContact as any).email || (selContact as any).phone || extraPhones(selContact).length || (selContact as any).website || (selContact as any).address" class="cd-info-grid">
            <div v-if="(selContact as any).email" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📧" icon="lucide:mail" :size="11" /></span>
              <a :href="'mailto:' + (selContact as any).email" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).email }}</a>
            </div>
            <div v-if="(selContact as any).phone" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📞" icon="lucide:phone" :size="11" /></span>
              <a :href="'tel:' + (selContact as any).phone" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).phone }}</a>
            </div>
            <div v-for="(p, i) in extraPhones(selContact)" :key="'ph' + i" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📞" icon="lucide:phone" :size="11" /></span>
              <a :href="'tel:' + p.value" class="cd-info-v" style="color: #4da6ff">{{ p.value }}<span v-if="p.label" style="color: var(--cd-dim); font-weight: 600"> · {{ p.label }}</span></a>
            </div>
            <div v-if="(selContact as any).website" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="🌐" icon="lucide:globe" :size="11" /></span>
              <a :href="websiteHref((selContact as any).website)" target="_blank" rel="noopener" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).website }}</a>
            </div>
            <div v-if="(selContact as any).address" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📍" icon="lucide:map-pin" :size="11" /></span>
              <a :href="'https://maps.google.com/?q=' + encodeURIComponent((selContact as any).address)" target="_blank" rel="noopener" class="cd-info-v" style="color: #4da6ff; white-space: pre-line">{{ (selContact as any).address }}</a>
            </div>
          </div>

          <!-- Follow buttons — open the contact's socials in a new tab. -->
          <div v-if="contactSocials(selContact).length" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px">
            <a v-for="s in contactSocials(selContact)" :key="s.key" :href="socialUrl(s.key, (selContact as any)[s.key])" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9999px; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text); font-size: 12px; font-weight: 700; text-decoration: none">
              <Icon :name="s.icon" :size="15" /> {{ s.label }}
            </a>
          </div>

          <!-- Earnest coach — Next steps (AI ideas) · Plan · saved History, tabbed
               into one card so they stop stacking and burying each other. -->
          <div class="cd-hscroll" style="margin-bottom: 10px">
            <CdTabs
              v-model="coachTab"
              :items="[
                { key: 'next', label: isMobile ? 'Next' : 'Next Steps', emoji: '✨', icon: 'lucide:sparkles' },
                { key: 'plan', label: 'Plan', emoji: '🎯', icon: 'lucide:flag', count: planCount || null },
                { key: 'history', label: isMobile ? 'AI History' : 'Earnest AI History', emoji: '🕓', icon: 'lucide:history', count: aiHistory.length || null },
              ]"
            />
          </div>

          <!-- Next steps — a single AI-ideas callout (chat lives on the floating Ask Earnest button). -->
          <div v-show="coachTab === 'next'" class="cd-log-sec" style="margin-bottom: 16px">
            <button
              type="button"
              style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 48px; padding: 12px; border-radius: 9999px; border: 1px solid color-mix(in srgb, var(--cd-accent) 32%, transparent); background: color-mix(in srgb, var(--cd-accent) 13%, transparent); color: var(--cd-accent); font-size: 13px; font-weight: 800; cursor: pointer; font-family: inherit"
              :disabled="sugLoading"
              @click="loadSuggestions"
            >
              <CdEarnestMark :size="18" />
              <span>{{ sugLoading ? 'Thinking…' : suggestions.length ? 'Refresh Earnest AI ideas' : 'Get Earnest AI ideas' }}</span>
            </button>
            <div v-if="!suggestions.length && !sugLoading && !sugError" style="font-size: 12px; color: var(--cd-muted); line-height: 1.5; margin-top: 10px">
              Tactical, contextual next moves for {{ selContact.name }} — from their history, rating, and your goal. Tap <strong>Save these to history</strong> to keep the good ones; they’ll land in the History tab.
            </div>
            <div v-if="sugError" style="font-size: 12px; color: #f87171; margin-top: 10px">{{ sugError }}</div>
            <div
              v-for="(s, i) in suggestions"
              :key="i"
              style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 12px; padding: 10px 12px; margin-top: 8px"
            >
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 3px">{{ s.icon }} {{ s.title }}</div>
              <div style="font-size: 12px; color: var(--cd-muted); line-height: 1.5">{{ s.body }}</div>
            </div>
            <button
              v-if="suggestions.length"
              class="cd-abtn"
              style="width: 100%; margin-top: 8px; background: transparent; border-color: var(--cd-bdr); color: var(--cd-muted); font-size: 11px; padding: 8px"
              :disabled="sugSaved"
              @click="saveSuggestions"
            >
              <CdIcon :emoji="sugSaved ? '✅' : '💾'" :icon="sugSaved ? 'lucide:check' : 'lucide:bookmark'" :size="11" />
              {{ sugSaved ? 'Saved to history' : 'Save these to history' }}
            </button>
          </div>

          <!-- Plan (kept mounted so its loaded tasks persist across tab switches) -->
          <PhoneContactPlans v-show="coachTab === 'plan'" :contact-id="(selContact as any).id" @ask="askEarnest" @count="planCount = $event" />

          <!-- History -->
          <div v-show="coachTab === 'history'" class="cd-log-sec" style="margin-bottom: 16px">
            <div v-if="historyLoading" style="font-size: 12px; color: var(--cd-muted)">Loading…</div>
            <template v-else-if="aiHistory.length">
              <input
                v-if="aiHistory.length > 2"
                v-model="historySearch"
                class="cd-inp"
                type="search"
                placeholder="Search this history…"
                style="margin-bottom: 8px"
              />
              <div v-if="!filteredHistory.length" style="font-size: 12px; color: var(--cd-muted)">No matches for “{{ historySearch }}”.</div>
              <div
                v-for="s in filteredHistory"
                :key="s.id"
                style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px"
              >
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px">
                  <button
                    style="flex: 1; text-align: left; background: none; border: none; cursor: pointer; color: var(--cd-text); padding: 0"
                    :title="s.type === 'chat' ? 'Continue this conversation' : 'Show details'"
                    @click="s.type === 'chat' ? continueChat(s) : (expandedSession = expandedSession === s.id ? null : s.id)"
                  >
                    <div style="font-size: 13px; font-weight: 700">{{ s.title }}</div>
                    <div style="font-size: 10px; color: var(--cd-dim); font-family: monospace">
                      {{ fmtFull(s.date_created) }} · {{ s.type }}<span v-if="s.type === 'chat'" style="color: var(--cd-accent)"> · tap to continue</span>
                    </div>
                  </button>
                  <div style="display: flex; align-items: center; gap: 4px">
                    <button v-if="s.type === 'chat'" style="background:none;border:none;cursor:pointer;padding:3px;color:var(--cd-accent)" title="Continue chat" @click="continueChat(s)"><CdIcon emoji="💬" icon="lucide:message-circle" :size="13" /></button>
                    <button :style="`background:none;border:none;cursor:pointer;padding:3px;opacity:${s._rated === 'up' ? 1 : 0.4}`" title="Helpful" @click="rateSession(s, 'up')"><CdIcon emoji="👍" icon="lucide:thumbs-up" :size="13" /></button>
                    <button :style="`background:none;border:none;cursor:pointer;padding:3px;opacity:${s._rated === 'down' ? 1 : 0.4}`" title="Not helpful" @click="rateSession(s, 'down')"><CdIcon emoji="👎" icon="lucide:thumbs-down" :size="13" /></button>
                    <button style="background: none; border: none; cursor: pointer; padding: 3px; color: var(--cd-dim)" title="Delete" @click="removeSession(s)"><CdIcon emoji="🗑" icon="lucide:trash-2" :size="11" /></button>
                  </div>
                </div>
                <div v-if="expandedSession === s.id" style="margin-top: 8px; border-top: 1px solid var(--cd-bdr); padding-top: 8px">
                  <div v-for="(line, li) in sessionLines(s)" :key="li" style="margin-bottom: 7px">
                    <div v-if="line.title" style="font-size: 12px; font-weight: 700">{{ line.title }}</div>
                    <div v-if="line.body" style="font-size: 12px; color: var(--cd-muted); line-height: 1.5">{{ line.body }}</div>
                  </div>
                </div>
              </div>
            </template>
            <div v-else style="text-align: center; padding: 18px 12px; border: 1px dashed var(--cd-bdr); border-radius: 14px; color: var(--cd-muted); display: flex; flex-direction: column; align-items: center; gap: 4px">
              <CdIcon icon="lucide:history" :size="18" style="color: var(--cd-accent)" />
              <div style="font-weight: 700; color: var(--cd-text); font-size: 13px">No saved history yet</div>
              <div style="font-size: 12px; line-height: 1.45; max-width: 240px">Save Earnest's ideas from <strong>Next steps</strong> — or a chat — and they'll collect here.</div>
            </div>
          </div>

          <div class="cd-log-sec">
            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-dim); margin-bottom: 8px">
              Log a touchpoint
            </div>
            <div class="cd-hscroll" style="display: flex; gap: 6px; margin-bottom: 8px; padding-bottom: 4px">
              <button
                v-for="t in ACT_TYPES"
                :key="t.key"
                class="cd-act-type"
                :class="{ sel: actType === t.key }"
                @click="actType = t.key"
              >
                <span style="font-size: 14px; display: block; margin-bottom: 2px"><CdIcon :emoji="t.icon" :icon="t.lucide" :size="14" /></span>{{ t.label }}
              </button>
            </div>
            <input v-model="actNote" class="cd-inp" placeholder="Quick note..." style="margin-bottom: 7px" />
            <input v-model="actDate" type="date" class="cd-inp" style="margin-bottom: 7px" />
            <div style="display: flex; gap: 6px">
              <button class="cd-abtn g" style="flex: 1; font-size: 12px; padding: 10px 6px" @click="doLogAct(false)"><CdIcon emoji="✅" icon="lucide:check-circle" :size="12" /> Log +25 XP</button>
              <button class="cd-abtn b" style="flex: 1; font-size: 12px; padding: 10px 6px" @click="doLogAct(true)"><CdIcon emoji="🎉" icon="lucide:party-popper" :size="12" /> Replied! +100</button>
            </div>
          </div>

          <div
            v-for="(act, i) in sortedActs"
            :key="act.id"
            style="display: flex; gap: 9px; margin-bottom: 13px; position: relative"
          >
            <div
              v-if="i < sortedActs.length - 1"
              style="position: absolute; left: 17px; top: 36px; width: 2px; bottom: -13px; background: var(--cd-bdr)"
            ></div>
            <div class="cd-tl-dot" :class="act.type"><CdIcon :emoji="getAct(act.type).icon" :icon="getAct(act.type).lucide" :size="17" /></div>
            <div style="flex: 1; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 12px; padding: 10px 12px">
              <template v-if="editingActId === act.id">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #4da6ff; margin-bottom: 6px">Edit Activity</div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px">
                  <button
                    v-for="t in ACT_TYPES.slice(0, 6)"
                    :key="t.key"
                    class="cd-act-type"
                    :class="{ sel: editActForm.type === t.key }"
                    style="font-size: 9px; padding: 3px 5px"
                    @click="editActForm.type = t.key"
                  >
                    <CdIcon :emoji="t.icon" :icon="t.lucide" :size="11" /> {{ t.label }}
                  </button>
                </div>
                <input v-model="editActForm.note" class="cd-inp" placeholder="Note..." style="margin-bottom: 5px; font-size: 12px; padding: 6px 8px" />
                <div style="display: flex; gap: 5px">
                  <input v-model="editActForm.date" type="date" class="cd-inp" style="flex: 0 0 120px; margin-bottom: 0; font-size: 11px; padding: 5px 6px" />
                  <button class="cd-abtn g" style="flex: 1; font-size: 11px; padding: 6px" @click="doSaveAct">Save</button>
                  <button class="cd-abtn" style="font-size: 11px; padding: 6px; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)" @click="cancelEditAct">Cancel</button>
                </div>
              </template>
              <template v-else>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
                  <div style="font-size: 14px; font-weight: 800">{{ act.label }}</div>
                  <div style="display: flex; align-items: center; gap: 6px">
                    <div style="font-size: 10px; color: var(--cd-dim); font-family: monospace">{{ fmtFull(act.date) }}</div>
                    <button
                      style="background: none; border: none; cursor: pointer; padding: 2px; font-size: 10px; color: var(--cd-dim)"
                      title="Edit"
                      @click="startEditAct(act)"
                    ><CdIcon emoji="✏️" icon="lucide:pencil" :size="10" /></button>
                    <button
                      style="background: none; border: none; cursor: pointer; padding: 2px; font-size: 10px; color: var(--cd-dim)"
                      title="Delete"
                      @click="confirmDeleteId = act.id"
                    ><CdIcon emoji="🗑" icon="lucide:trash-2" :size="10" /></button>
                  </div>
                </div>
                <div v-if="act.note" style="font-size: 12px; color: var(--cd-muted); line-height: 1.5; margin-bottom: 7px">{{ act.note }}</div>
                <div v-if="confirmDeleteId === act.id" style="background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.25); border-radius: 8px; padding: 8px; margin-bottom: 7px">
                  <div style="font-size: 11px; font-weight: 700; color: #f87171; margin-bottom: 6px">Delete this activity? You'll lose {{ xpForActivity(act) }} XP.</div>
                  <div style="display: flex; gap: 6px">
                    <button
                      class="cd-abtn"
                      style="flex: 1; font-size: 11px; padding: 6px; background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.3); color: #f87171"
                      @click="doDeleteAct(act)"
                    ><CdIcon emoji="🗑" icon="lucide:trash-2" :size="10" /> Delete</button>
                    <button
                      class="cd-abtn"
                      style="flex: 1; font-size: 11px; padding: 6px; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)"
                      @click="confirmDeleteId = null"
                    >Cancel</button>
                  </div>
                </div>
                <div
                  class="cd-tl-resp"
                  :class="act.is_response ? 'yes' : 'no'"
                  @click="!act.is_response && doMarkResponded(act.id)"
                >
                  {{ act.is_response ? '✓ ' + (act.response_note || 'Responded') : '○ No reply — tap to mark' }}
                </div>
              </template>
            </div>
          </div>

          <button
            v-if="!(selContact as any).is_client && !(selContact as any).is_partner"
            class="cd-abtn"
            style="width: 100%; margin: 8px 0; background: rgba(0,255,135,0.08); border-color: rgba(0,255,135,0.3); color: var(--cd-green); font-size: 14px; padding: 12px; font-weight: 800"
            @click="openGraduate"
          ><CdIcon emoji="🎓" icon="lucide:graduation-cap" :size="14" /> Graduate to client or partner</button>
          <button
            v-else
            class="cd-abtn"
            style="width: 100%; margin: 8px 0; background: transparent; border-color: var(--cd-bdr); color: var(--cd-muted); font-size: 12px; padding: 10px"
            @click="doRevertGraduation"
          ><CdIcon emoji="↩️" icon="lucide:rotate-ccw" :size="13" /> Revert to an active contact</button>

          <!-- Source & referrals — invite/share + provenance, kept near the bottom. -->
          <PhoneContactReferral :contact="(selContact as any)" placement="footer" />

          <div style="display: flex; gap: 7px; margin: 8px 0 20px">
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); font-size: 12px; padding: 9px"
              @click="startEdit"
            ><CdIcon emoji="✏️" icon="lucide:pencil" :size="12" /> Edit</button>
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); font-size: 12px; padding: 9px"
              title="Share this contact as a card (.vcf) — add to iOS/Android Contacts"
              @click="shareContact"
            ><CdIcon emoji="📇" icon="lucide:contact-round" :size="13" /> {{ shareCopied ? 'Copied!' : 'Share card' }}</button>
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: var(--cd-dim); border-color: var(--cd-bdr); font-size: 12px; padding: 9px"
              @click="doHibernate(selContact.id)"
            ><CdIcon emoji="😴" icon="lucide:moon" :size="12" /> Hibernate</button>
          </div>
        </div>
      </Transition>
    </template>

    <!-- Pipeline Stage Sheet -->
    <PhoneSheet v-model:open="showStageSheet">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">Where are you with {{ selContact?.name }}?</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">Move them along — we handle the rest.</div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <button
              v-for="s in PIPELINE_STAGES.filter((x) => x.group === 'forward')"
              :key="s.key"
              style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; text-align: left"
              :style="selContact?.pipeline_stage === s.key ? 'border-color: var(--cd-accent); background: rgba(0,255,135,0.06)' : ''"
              @click="doMoveStage(s.key)"
            >
              <CdIcon :emoji="s.emoji" :icon="s.lucide" :size="16" />
              {{ s.label }}
              <span v-if="selContact?.pipeline_stage === s.key" style="margin-left: auto; font-size: 10px; color: var(--cd-accent)">current</span>
              <span v-else-if="s.key === 'opportunity'" style="margin-left: auto; font-size: 10px; color: var(--cd-dim)">client or partner →</span>
            </button>
          </div>
          <!-- Off-ramp, tucked beneath a divider so it never reads as a forward step. -->
          <div style="height: 1px; background: var(--cd-bdr); margin: 12px 0 8px" />
          <button
            style="display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 14px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 12px; cursor: pointer; text-align: left"
            @click="doMoveStage('lost')"
          >
            <CdIcon emoji="🌙" icon="lucide:moon" :size="14" /> Not now — didn't work out
          </button>
          <button style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showStageSheet = false">Cancel</button>
    </PhoneSheet>

    <!-- Lost Reason Sheet -->
    <PhoneSheet v-model:open="showLostReasonSheet">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 4px">Why was this deal lost?</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">Logging reasons helps you learn. +10 XP</div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <button
              v-for="reason in LOST_REASONS"
              :key="reason"
              style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 600; cursor: pointer; text-align: left"
              :style="selectedLostReason === reason ? 'border-color: var(--cd-orange); background: rgba(255,107,53,0.06)' : ''"
              @click="selectedLostReason = reason"
            >
              {{ reason }}
              <span v-if="selectedLostReason === reason" style="margin-left: auto; color: var(--cd-orange)">✓</span>
            </button>
          </div>
          <button
            class="cd-abtn o"
            style="margin-top: 12px"
            :disabled="!selectedLostReason"
            @click="doLogLostReason"
          ><CdIcon emoji="📝" icon="lucide:clipboard-check" :size="14" /> Log Lost Reason</button>
          <button style="width: 100%; padding: 10px; margin-top: 6px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showLostReasonSheet = false; showStageSheet = true">← Back</button>
    </PhoneSheet>

    <!-- Industry picker — color-coded, mirrors the rating/pursuing pickers -->
    <PhoneSheet v-model:open="showIndustrySheet">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">Industry for {{ selContact?.name }}</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">Color-codes their tag and the orbit.</div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px">
            <button
              v-for="ind in INDUSTRIES"
              :key="ind"
              type="button"
              style="padding: 8px 12px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit"
              :style="(selContact as any)?.industry === ind ? industryTagStyle(ind) : ''"
              @click="doSetIndustry(ind)"
            >{{ ind }}</button>
          </div>
          <button
            v-if="(selContact as any)?.industry"
            style="width: 100%; padding: 10px; margin-top: 12px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer"
            @click="doSetIndustry(null)"
          >Clear</button>
          <button style="width: 100%; padding: 10px; margin-top: 6px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showIndustrySheet = false">Cancel</button>
    </PhoneSheet>

    <!-- Free-text objective quick-edit -->
    <PhoneSheet v-model:open="showObjectiveSheet">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">Objective with {{ selContact?.name }}</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">The specific win you're chasing — keep it short.</div>
          <input
            v-model="objectiveDraft"
            class="cd-inp"
            maxlength="80"
            placeholder="e.g. Sign a small-business design package"
            @keyup.enter="doSaveObjective"
          />
          <div style="text-align: right; font-size: 10px; color: var(--cd-dim); margin: 4px 2px 12px">{{ objectiveDraft.length }}/80</div>
          <button class="cd-abtn g" style="width: 100%" @click="doSaveObjective">Save objective</button>
          <button
            v-if="(selContact as any)?.objective"
            style="width: 100%; padding: 10px; margin-top: 8px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer"
            @click="objectiveDraft = ''; doSaveObjective()"
          >Clear objective</button>
          <button style="width: 100%; padding: 10px; margin-top: 6px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showObjectiveSheet = false">Cancel</button>
    </PhoneSheet>

    <!-- Optional goal tag picker (independent of stage) -->
    <PhoneSheet v-model:open="showGoalTagSheet">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">Pursuing {{ selContact?.name }} as…</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">Optional — are you chasing them as a client or a partner?</div>
          <div style="display: flex; flex-direction: column; gap: 8px">
            <button
              v-for="g in GOAL_OPTIONS"
              :key="g.key"
              style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 14px; font-weight: 700; cursor: pointer; text-align: left"
              :style="(selContact as any)?.opportunity_goal === g.key ? 'border-color: var(--cd-accent); background: rgba(0,255,135,0.07)' : ''"
              @click="doSetGoalTag(g.key)"
            >
              <CdIcon :emoji="g.emoji" :icon="g.lucide" :size="20" />
              <span>{{ g.label }}<br><span style="font-size: 11px; font-weight: 500; color: var(--cd-muted)">{{ g.hint }}</span></span>
              <span v-if="(selContact as any)?.opportunity_goal === g.key" style="margin-left: auto; font-size: 10px; color: var(--cd-accent)">current</span>
            </button>
          </div>
          <button
            v-if="(selContact as any)?.opportunity_goal"
            style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer"
            @click="doSetGoalTag(null)"
          >Clear</button>
          <button style="width: 100%; padding: 10px; margin-top: 6px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showGoalTagSheet = false">Cancel</button>
    </PhoneSheet>

    <!-- Goal picker — shown when entering the Opportunity stage -->
    <PhoneSheet v-model:open="showGoalSheet">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 2px">Pursuing {{ selContact?.name }} as…</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">This tailors the ideas Earnest gives you. You can change it later.</div>
          <div style="display: flex; flex-direction: column; gap: 8px">
            <button
              v-for="g in GOAL_OPTIONS"
              :key="g.key"
              style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 14px; font-weight: 700; cursor: pointer; text-align: left"
              @click="doPickGoal(g.key)"
            >
              <CdIcon :emoji="g.emoji" :icon="g.lucide" :size="20" />
              <span>{{ g.label }}<br><span style="font-size: 11px; font-weight: 500; color: var(--cd-muted)">{{ g.hint }}</span></span>
            </button>
          </div>
          <button style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showGoalSheet = false; showStageSheet = true">← Back</button>
    </PhoneSheet>

    <!-- Graduate sheet — captures what sealed it, then hands off to Earnest -->
    <PhoneSheet v-model:open="showGraduateSheet" padding="18px 16px">
          <div style="font-size: 30px; text-align: center; margin-bottom: 6px"><CdIcon emoji="🎓" icon="lucide:graduation-cap" :size="30" /></div>
          <div style="font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 10px">Graduate {{ selContact?.name }}</div>
          <!-- Goal toggle -->
          <div style="display: flex; gap: 6px; margin-bottom: 14px">
            <button
              v-for="g in GOAL_OPTIONS"
              :key="g.key"
              style="flex: 1; padding: 10px; border-radius: 10px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 700; cursor: pointer"
              :style="graduateGoal === g.key ? 'border-color: var(--cd-accent); background: rgba(0,255,135,0.07)' : ''"
              @click="graduateGoal = g.key"
            ><CdIcon :emoji="g.emoji" :icon="g.lucide" :size="14" /> {{ g.label }}</button>
          </div>
          <!-- What sealed it -->
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 6px">What sealed it?</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px">
            <button
              v-for="r in CONVERSION_REASONS"
              :key="r"
              style="padding: 7px 12px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 12px; font-weight: 600; cursor: pointer"
              :style="selectedConversionReason === r ? 'border-color: var(--cd-accent); background: rgba(0,255,135,0.07)' : ''"
              @click="selectedConversionReason = (selectedConversionReason === r ? '' : r)"
            >{{ r }}</button>
          </div>
          <input
            v-model="conversionNote"
            placeholder="Add a note (optional)"
            style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; margin-bottom: 14px; font-family: inherit"
          >
          <button class="cd-abtn g" style="font-size: 15px; padding: 13px" @click="doGraduate">
            <CdIcon emoji="🎉" icon="lucide:party-popper" :size="14" /> Graduate to {{ graduateGoal }} +200 XP
          </button>
          <button style="width: 100%; padding: 10px; margin-top: 8px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showGraduateSheet = false">Cancel</button>
    </PhoneSheet>

    <!-- Post-graduation Earnest hand-off (deep-link or sign-up nudge) -->
    <PhoneEarnestHandoffSheet v-model:open="showEarnestHandoff" :contact="selContact" :goal="graduateGoal" />
  </div>
</template>
