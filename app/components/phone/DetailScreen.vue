<script setup lang="ts">
import { RATINGS, ACT_TYPES, getRating, getAct, cEmoji } from '~/composables/useConstants'
import { todayStr, fmtFull } from '~/composables/useFormatters'
import { PIPELINE_STAGES, LOST_REASONS } from '~/composables/usePipeline'
import { SOCIALS, SOCIAL_KEYS, socialUrl } from '~/types/socials'
import type { PipelineStage } from '~/types/directus'
import confettiLib from 'canvas-confetti'

const { contacts, updateContact, uploadContactImage, removeContactImage, hibernate, logActivity, markResponded, updateActivity, deleteActivity, lastActivity, daysSince, followUpStatus } = useContacts()
const { state: xp, earn, deduct, completeMission } = useXp()
const { success, error: showError } = useToast()
const { selectedId, editing, nav } = useNavigation()

// ── Contact photo upload (downscaled client-side, filed in Contact Photos) ──
const contactPhotoEl = ref<HTMLInputElement | null>(null)
const photoUploading = ref(false)
async function onContactPhoto(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  const c = selContact.value as any
  if (!f || !c) return
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
const { moveToStage, getStageInfo } = usePipeline()

const selContact = computed(() => contacts.value.find((c) => c.id === selectedId.value) ?? null)

// Pipeline stage management
const showStageSheet = ref(false)
const showLostReasonSheet = ref(false)
const selectedLostReason = ref('')

// Marking a client is a big, celebrated step (+200 XP, confetti) — gate it
// behind a confirm so it can't happen on an accidental tap.
const showClientConfirm = ref(false)

async function doMoveStage(stage: PipelineStage) {
  if (!selContact.value) return
  if (stage === 'lost') {
    showStageSheet.value = false
    showLostReasonSheet.value = true
    return
  }
  await moveToStage(selContact.value.id, stage, {})
  if (stage === 'won') fireConfetti()
  showStageSheet.value = false
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

function startEdit() {
  const c = selContact.value as any
  if (!c) return
  editForm.value = {
    name: c.name, title: c.title, company: c.company,
    email: c.email, phone: c.phone, industry: c.industry,
    met_at: c.met_at, location: c.location, address: c.address, rating: c.rating, notes: c.notes,
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, c[k]])),
  }
  editing.value = true
}

/** The platforms this contact has a handle for (for the follow buttons). */
function contactSocials(c: any) {
  return SOCIALS.filter((s) => c?.[s.key])
}

async function doSaveEdit() {
  if (!selContact.value) return
  await updateContact((selContact.value as any).id, editForm.value)
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

// Mark as client (called from the confirm sheet, never directly from a tap).
async function doMarkClient() {
  showClientConfirm.value = false
  if (!selContact.value) return
  const c = selContact.value as any
  if (c.is_client) return
  await updateContact(c.id, { is_client: true, client_at: new Date().toISOString().slice(0, 10) } as any)
  try {
    await logActivity({
      contact: c.id,
      type: 'converted_client',
      label: 'Converted to Client',
      date: new Date().toISOString().slice(0, 10),
      note: c.company ? `${c.name} at ${c.company} is now a client` : `${c.name} is now a client`,
    } as any)
  } catch (err: any) {
    console.error('[Detail] Failed to log converted_client activity:', err?.data?.message ?? err)
  }
  earn(200, '💰', 'Client converted! You closed the deal.', { total_clients: (xp.value.total_clients ?? 0) + 1 })
  fireConfetti()
}

// Flip a client back to a regular contact — easy, one tap, no confetti. Backs
// out the +200 XP so an accidental conversion leaves no trace, and updates the
// client count. Forgiving on purpose: the dangerous direction is marking, not unmarking.
async function doUnmarkClient() {
  if (!selContact.value) return
  const c = selContact.value as any
  if (!c.is_client) return
  await updateContact(c.id, { is_client: false, client_at: null } as any)
  deduct(200, '↩️', 'Back to an active contact', { total_clients: Math.max(0, (xp.value.total_clients ?? 1) - 1) })
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
  if (act.type === 'converted_client') return 200
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
        contact: { name: c.name, title: c.title, company: c.company, industry: c.industry, location: c.location, rating: c.rating, notes: c.notes },
        activities: sortedActs.value.slice(0, 10).map((a: any) => ({ date: a.date, label: a.label, note: a.note, is_response: a.is_response })),
        daysSinceLastActivity: daysSince(c),
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
const sugSaved = ref(false)

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
const { open: openChat, resume: resumeChat } = useChat()

function contactContext() {
  const c = selContact.value as any
  if (!c) return null
  return {
    name: c.name, title: c.title, company: c.company, industry: c.industry,
    rating: c.rating, pipeline_stage: c.pipeline_stage, estimated_value: c.estimated_value,
    met_at: c.met_at, location: c.location, is_client: c.is_client, notes: c.notes,
    days_since_last_activity: daysSince(c),
    recent_activities: sortedActs.value.slice(0, 8).map((a: any) => ({
      date: a.date, label: a.label, note: a.note, is_response: a.is_response,
    })),
  }
}

function contactFocus(): string {
  const c = selContact.value as any
  if (!c) return ''
  return `the contact "${c.name}"${c.company ? ` from ${c.company}` : ''} — their CRM profile (rating, pipeline stage, notes, and full activity history)`
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
      <template v-if="editing">
        <div class="cd-scrl cd-pad">
          <button class="cd-back" @click="editing = false">← Cancel</button>
          <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px">Edit Contact</div>
          <label class="cd-lbl">Name</label><input v-model="editForm.name" class="cd-inp" />
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <div><label class="cd-lbl">Title</label><input v-model="editForm.title" class="cd-inp" /></div>
            <div><label class="cd-lbl">Company</label><input v-model="editForm.company" class="cd-inp" /></div>
          </div>
          <label class="cd-lbl">Email</label><input v-model="editForm.email" class="cd-inp" type="email" />
          <label class="cd-lbl">Phone</label><input v-model="editForm.phone" class="cd-inp" />
          <label class="cd-lbl">Location <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· city / region</span></label><input v-model="editForm.location" class="cd-inp" placeholder="Austin, TX" />
          <label class="cd-lbl">Address</label><textarea v-model="editForm.address" class="cd-inp" style="min-height: 48px; resize: vertical"></textarea>
          <template v-for="s in SOCIALS" :key="s.key">
            <label class="cd-lbl">{{ s.label }}</label><input v-model="editForm[s.key]" class="cd-inp" :placeholder="s.placeholder" />
          </template>
          <label class="cd-lbl">Rating</label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px">
            <button
              v-for="r in RATINGS"
              :key="r.key"
              class="cd-rpick"
              :style="editForm.rating === r.key ? 'background:' + r.color + '22;border-color:' + r.color + ';color:' + r.color : ''"
              @click="editForm.rating = editForm.rating === r.key ? '' : r.key"
            ><CdIcon :emoji="r.emoji" :icon="r.lucide" :size="12" /> {{ r.label }}</button>
          </div>
          <label class="cd-lbl">Notes</label>
          <textarea v-model="editForm.notes" class="cd-inp" style="min-height: 60px; resize: vertical"></textarea>
          <button class="cd-abtn g" style="margin-top: 4px" @click="doSaveEdit">Save Changes</button>
        </div>
      </template>
      <template v-else>
        <div class="cd-scrl cd-pad">
          <button class="cd-back" @click="nav('contacts')"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Back</button>
          <div class="cd-det-hero">
            <div style="display: flex; align-items: center; gap: 11px; margin-bottom: 10px">
              <div class="cd-det-av-wrap">
                <button class="cd-det-av cd-det-av-btn" type="button" :disabled="photoUploading" :title="(selContact as any).imageUrl ? 'Change photo' : 'Add a photo'" @click="contactPhotoEl?.click()">
                  <img v-if="(selContact as any).imageUrl" :src="(selContact as any).imageUrl" alt="" />
                  <CdIcon v-else :emoji="cEmoji(selContact)" icon="lucide:user" :size="24" />
                  <span class="cd-det-av-cam"><CdIcon :icon="photoUploading ? 'lucide:loader-circle' : 'lucide:camera'" :size="11" /></span>
                </button>
                <button v-if="(selContact as any).imageUrl" class="cd-det-av-rm" type="button" :disabled="photoUploading" title="Remove photo" aria-label="Remove photo" @click="onRemovePhoto">
                  <CdIcon icon="lucide:x" :size="11" />
                </button>
              </div>
              <input ref="contactPhotoEl" type="file" accept="image/*" hidden @change="onContactPhoto" />
              <div>
                <div style="font-family: 'Bebas Neue', sans-serif; font-size: 26px; line-height: 1; margin-bottom: 3px">{{ selContact.name }}</div>
                <div style="font-size: 12px; color: var(--cd-muted)">
                  {{ [(selContact as any).title, (selContact as any).company].filter(Boolean).join(' · ') }}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap">
              <span v-if="selContact.rating" class="cd-rpill" :class="selContact.rating">
                <CdIcon :emoji="getRating(selContact.rating)?.emoji ?? ''" :icon="getRating(selContact.rating)?.lucide" :size="10" /> {{ getRating(selContact.rating)?.label }}
              </span>
              <button v-if="(selContact as any).is_client" type="button" title="Tap to revert to an active contact" style="background: rgba(0,255,135,0.12); border: 1px solid rgba(0,255,135,0.3); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: var(--cd-green); cursor: pointer; font-family: inherit" @click="doUnmarkClient">
                <CdIcon emoji="💰" icon="lucide:badge-check" :size="10" /> Client
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
              <span v-if="(selContact as any).industry" class="cd-tag-ind">{{ (selContact as any).industry }}</span>
              <span v-if="(selContact as any).location" class="cd-tag-ind"><CdIcon emoji="📍" icon="lucide:map-pin" :size="9" /> {{ (selContact as any).location }}</span>
              <span v-if="(selContact as any).met_at" class="cd-tag-ind">@ {{ (selContact as any).met_at }}</span>
            </div>
          </div>

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

          <div v-if="(selContact as any).email || (selContact as any).phone || (selContact as any).address" class="cd-info-grid">
            <div v-if="(selContact as any).email" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📧" icon="lucide:mail" :size="11" /></span>
              <a :href="'mailto:' + (selContact as any).email" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).email }}</a>
            </div>
            <div v-if="(selContact as any).phone" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📞" icon="lucide:phone" :size="11" /></span>
              <a :href="'tel:' + (selContact as any).phone" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).phone }}</a>
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

          <PhoneContactReferral :contact="(selContact as any)" />

          <div class="cd-log-sec" style="margin-bottom: 16px">
            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-dim); margin-bottom: 10px">
              Next Steps
            </div>
            <!-- Two AI actions, side by side: tactical ideas (blue) vs open chat (green).
                 Equal columns + matched min-height keep the tiles the same size. -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px">
              <button
                type="button"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; min-height: 78px; padding: 12px 8px; border-radius: 14px; border: 1px solid color-mix(in srgb, #4da6ff 38%, transparent); background: color-mix(in srgb, #4da6ff 12%, transparent); color: #4da6ff; font-size: 12px; font-weight: 700; line-height: 1.25; cursor: pointer; font-family: inherit"
                :disabled="sugLoading"
                @click="loadSuggestions"
              >
                <CdEarnestMark :size="18" />
                <span>{{ sugLoading ? 'Thinking…' : suggestions.length ? 'Refresh AI ideas' : 'Get Earnest AI ideas' }}</span>
              </button>
              <button
                type="button"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; min-height: 78px; padding: 12px 8px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--cd-accent) 32%, transparent); background: color-mix(in srgb, var(--cd-accent) 13%, transparent); color: var(--cd-accent); font-size: 12px; font-weight: 700; line-height: 1.25; cursor: pointer; font-family: inherit"
                @click="askEarnest"
              >
                <CdEarnestMark :size="18" />
                <span>Chat with Earnest about {{ selContact.name }}</span>
              </button>
            </div>
            <div v-if="sugError" style="font-size: 12px; color: #f87171; margin-bottom: 8px">{{ sugError }}</div>
            <div
              v-for="(s, i) in suggestions"
              :key="i"
              style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px"
            >
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 3px">{{ s.icon }} {{ s.title }}</div>
              <div style="font-size: 12px; color: var(--cd-muted); line-height: 1.5">{{ s.body }}</div>
            </div>
            <button
              v-if="suggestions.length"
              class="cd-abtn"
              style="width: 100%; margin-top: 4px; background: transparent; border-color: var(--cd-bdr); color: var(--cd-muted); font-size: 11px; padding: 8px"
              :disabled="sugSaved"
              @click="saveSuggestions"
            >
              <CdIcon :emoji="sugSaved ? '✅' : '💾'" :icon="sugSaved ? 'lucide:check' : 'lucide:bookmark'" :size="11" />
              {{ sugSaved ? 'Saved to history' : 'Save these to history' }}
            </button>
          </div>

          <PhoneContactPlans :contact-id="(selContact as any).id" @ask="askEarnest" />

          <div v-if="aiHistory.length || historyLoading" class="cd-log-sec" style="margin-bottom: 16px">
            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-dim); margin-bottom: 8px">
              Earnest AI History
            </div>
            <div v-if="historyLoading" style="font-size: 12px; color: var(--cd-muted)">Loading…</div>
            <div
              v-for="s in aiHistory"
              :key="s.id"
              style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 12px; padding: 10px 12px; margin-bottom: 8px"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px">
                <button
                  style="flex: 1; text-align: left; background: none; border: none; cursor: pointer; color: var(--cd-text); padding: 0"
                  @click="expandedSession = expandedSession === s.id ? null : s.id"
                >
                  <div style="font-size: 13px; font-weight: 700">{{ s.title }}</div>
                  <div style="font-size: 10px; color: var(--cd-dim); font-family: monospace">{{ fmtFull(s.date_created) }} · {{ s.type }}</div>
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
            v-if="!(selContact as any).is_client"
            class="cd-abtn"
            style="width: 100%; margin: 8px 0; background: rgba(0,255,135,0.08); border-color: rgba(0,255,135,0.3); color: var(--cd-green); font-size: 14px; padding: 12px; font-weight: 800"
            @click="showClientConfirm = true"
          ><CdIcon emoji="💰" icon="lucide:badge-check" :size="14" /> Mark as Client +200 XP</button>
          <button
            v-else
            class="cd-abtn"
            style="width: 100%; margin: 8px 0; background: transparent; border-color: var(--cd-bdr); color: var(--cd-muted); font-size: 12px; padding: 10px"
            @click="doUnmarkClient"
          ><CdIcon emoji="↩️" icon="lucide:rotate-ccw" :size="13" /> This isn't a client — revert to contact</button>

          <div style="display: flex; gap: 7px; margin: 8px 0 20px">
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); font-size: 12px; padding: 9px"
              @click="startEdit"
            ><CdIcon emoji="✏️" icon="lucide:pencil" :size="12" /> Edit</button>
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); font-size: 12px; padding: 9px"
              @click="shareContact"
            ><CdIcon emoji="📤" icon="lucide:share-2" :size="12" /> {{ shareCopied ? 'Copied!' : 'Share' }}</button>
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: var(--cd-dim); border-color: var(--cd-bdr); font-size: 12px; padding: 9px"
              @click="doHibernate(selContact.id)"
            ><CdIcon emoji="😴" icon="lucide:moon" :size="12" /> Hibernate</button>
          </div>
        </div>
      </template>
    </template>

    <!-- Pipeline Stage Sheet -->
    <Transition name="cd-pop">
      <div v-if="showStageSheet" style="position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center" @click.self="showStageSheet = false">
        <div style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px 14px 0 0; padding: 16px; width: 100%; max-width: 768px">
          <div style="font-size: 14px; font-weight: 800; margin-bottom: 12px">Move to Stage</div>
          <div style="display: flex; flex-direction: column; gap: 6px">
            <button
              v-for="s in PIPELINE_STAGES"
              :key="s.key"
              style="display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; text-align: left"
              :style="selContact?.pipeline_stage === s.key ? 'border-color: var(--cd-accent); background: rgba(0,255,135,0.06)' : ''"
              @click="doMoveStage(s.key)"
            >
              <CdIcon :emoji="s.emoji" :icon="s.lucide" :size="16" />
              {{ s.label }}
              <span v-if="selContact?.pipeline_stage === s.key" style="margin-left: auto; font-size: 10px; color: var(--cd-accent)">current</span>
            </button>
          </div>
          <button style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showStageSheet = false">Cancel</button>
        </div>
      </div>
    </Transition>

    <!-- Lost Reason Sheet -->
    <Transition name="cd-pop">
      <div v-if="showLostReasonSheet" style="position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center" @click.self="showLostReasonSheet = false">
        <div style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px 14px 0 0; padding: 16px; width: 100%; max-width: 768px">
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
        </div>
      </div>
    </Transition>

    <!-- Mark-as-Client confirm — a deliberate gate on a big, hard-to-spot-undo step -->
    <Transition name="cd-pop">
      <div v-if="showClientConfirm" style="position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center" @click.self="showClientConfirm = false">
        <div style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px 14px 0 0; padding: 18px 16px; width: 100%; max-width: 768px">
          <div style="font-size: 30px; text-align: center; margin-bottom: 6px"><CdIcon emoji="💰" icon="lucide:badge-check" :size="30" /></div>
          <div style="font-size: 16px; font-weight: 800; text-align: center; margin-bottom: 4px">Mark {{ selContact?.name }} as a client?</div>
          <div style="font-size: 12px; color: var(--cd-muted); text-align: center; margin-bottom: 16px; line-height: 1.5">
            This logs a “Converted to Client” milestone and awards +200 XP. You can revert later from this page.
          </div>
          <button class="cd-abtn g" style="font-size: 15px; padding: 13px" @click="doMarkClient">
            <CdIcon emoji="💰" icon="lucide:badge-check" :size="14" /> Yes, they're a client
          </button>
          <button style="width: 100%; padding: 10px; margin-top: 8px; border-radius: 9999px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showClientConfirm = false">Cancel</button>
        </div>
      </div>
    </Transition>
  </div>
</template>
