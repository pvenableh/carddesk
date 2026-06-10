<script setup lang="ts">
import { RATINGS, ACT_TYPES, getRating, getAct, cEmoji } from '~/composables/useConstants'
import { todayStr, fmtFull } from '~/composables/useFormatters'
import { PIPELINE_STAGES, LOST_REASONS } from '~/composables/usePipeline'
import { SOCIALS, SOCIAL_KEYS, socialUrl } from '~/types/socials'
import type { PipelineStage } from '~/types/directus'
import confettiLib from 'canvas-confetti'

const { contacts, updateContact, hibernate, logActivity, markResponded, updateActivity, deleteActivity, lastActivity, daysSince, followUpStatus } = useContacts()
const { state: xp, earn, deduct } = useXp()
const { selectedId, editing, nav } = useNavigation()
const { profile } = useProfile()
const { moveToStage, getStageInfo } = usePipeline()

const selContact = computed(() => contacts.value.find((c) => c.id === selectedId.value) ?? null)

// Pipeline stage management
const showStageSheet = ref(false)
const showLostReasonSheet = ref(false)
const selectedLostReason = ref('')

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
    met_at: c.met_at, rating: c.rating, notes: c.notes,
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
  } else {
    c.rating === 'hot'
      ? earn(50, '⚡', "Don't leave them hanging.")
      : earn(25, '✉️', "They'll remember you.")
  }
}

async function doMarkResponded(actId: string) {
  if (!selContact.value) return
  const c = selContact.value as any
  await markResponded(c.id, actId)
  earn(100, '🎉', 'They replied!', { hot_responses: (xp.value.hot_responses ?? 0) + 1 })
  fireConfetti()
}

async function doHibernate(id: string) {
  await hibernate(id)
  nav('contacts')
}

// Mark as client
async function doMarkClient() {
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
        contact: { name: c.name, title: c.title, company: c.company, industry: c.industry, rating: c.rating, notes: c.notes },
        activities: sortedActs.value.slice(0, 10).map((a: any) => ({ date: a.date, label: a.label, note: a.note, is_response: a.is_response })),
        daysSinceLastActivity: daysSince(c),
        profile: profile.value,
      },
    })
    suggestions.value = data
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
    met_at: c.met_at, is_client: c.is_client, notes: c.notes,
    days_since_last_activity: daysSince(c),
    recent_activities: sortedActs.value.slice(0, 8).map((a: any) => ({
      date: a.date, label: a.label, note: a.note, is_response: a.is_response,
    })),
  }
}

function askEarnest() {
  const c = selContact.value as any
  if (!c) return
  analytics.aiFeatureUse('chat')
  openChat({
    scope: 'contact',
    title: c.name,
    contactId: c.id,
    context: contactContext(),
    intro: `Let's talk about ${c.name}${c.company ? ` at ${c.company}` : ''}. Want help with your next move, a follow-up message, or moving them through your pipeline?`,
  })
  nav('chat')
}

function continueChat(s: any) {
  resumeChat(s, contactContext(), 'contact')
  nav('chat')
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
              <div class="cd-det-av"><CdIcon :emoji="cEmoji(selContact)" icon="lucide:user" :size="24" /></div>
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
              <span v-if="(selContact as any).is_client" style="background: rgba(0,255,135,0.12); border: 1px solid rgba(0,255,135,0.3); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: var(--cd-green)">
                <CdIcon emoji="💰" icon="lucide:badge-check" :size="10" /> Client
              </span>
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

          <div v-if="(selContact as any).email || (selContact as any).phone" class="cd-info-grid">
            <div v-if="(selContact as any).email" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📧" icon="lucide:mail" :size="11" /></span>
              <a :href="'mailto:' + (selContact as any).email" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).email }}</a>
            </div>
            <div v-if="(selContact as any).phone" class="cd-info-row">
              <span class="cd-info-k"><CdIcon emoji="📞" icon="lucide:phone" :size="11" /></span>
              <a :href="'tel:' + (selContact as any).phone" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).phone }}</a>
            </div>
          </div>

          <!-- Follow buttons — open the contact's socials in a new tab. -->
          <div v-if="contactSocials(selContact).length" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px">
            <a v-for="s in contactSocials(selContact)" :key="s.key" :href="socialUrl(s.key, (selContact as any)[s.key])" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text); font-size: 12px; font-weight: 700; text-decoration: none">
              <Icon :name="s.icon" :size="15" /> {{ s.label }}
            </a>
          </div>

          <div class="cd-log-sec" style="margin-bottom: 16px">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
              <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-dim)">
                Next Steps
              </div>
              <button
                class="cd-abtn"
                style="font-size: 11px; padding: 5px 10px; background: transparent; border-color: var(--cd-bdr); color: #4da6ff"
                :disabled="sugLoading"
                @click="loadSuggestions"
              >
                <CdIcon emoji="🤖" icon="lucide:sparkles" :size="11" />
                {{ sugLoading ? 'Thinking...' : suggestions.length ? 'Refresh' : 'Get Earnest AI Ideas' }}
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

            <!-- Open-ended chat about this contact (continuable, 1 credit/turn) -->
            <button
              class="cd-abtn"
              style="width: 100%; margin-top: 8px; padding: 11px; font-size: 13px; background: color-mix(in srgb, var(--cd-accent) 12%, transparent); border-color: color-mix(in srgb, var(--cd-accent) 30%, transparent); color: var(--cd-accent)"
              @click="askEarnest"
            >
              <CdIcon emoji="💬" icon="lucide:sparkles" :size="13" /> Chat with Earnest about {{ selContact.name }}
            </button>
          </div>

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
            @click="doMarkClient"
          ><CdIcon emoji="💰" icon="lucide:badge-check" :size="14" /> Mark as Client +200 XP</button>

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
              style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; text-align: left"
              :style="selContact?.pipeline_stage === s.key ? 'border-color: var(--cd-accent); background: rgba(0,255,135,0.06)' : ''"
              @click="doMoveStage(s.key)"
            >
              <CdIcon :emoji="s.emoji" :icon="s.lucide" :size="16" />
              {{ s.label }}
              <span v-if="selContact?.pipeline_stage === s.key" style="margin-left: auto; font-size: 10px; color: var(--cd-accent)">current</span>
            </button>
          </div>
          <button style="width: 100%; padding: 10px; margin-top: 10px; border-radius: 10px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showStageSheet = false">Cancel</button>
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
              style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--cd-bdr); background: var(--cd-bg); color: var(--cd-text); font-size: 13px; font-weight: 600; cursor: pointer; text-align: left"
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
          <button style="width: 100%; padding: 10px; margin-top: 6px; border-radius: 10px; border: 1px solid var(--cd-bdr); background: transparent; color: var(--cd-dim); font-size: 13px; cursor: pointer" @click="showLostReasonSheet = false; showStageSheet = true">← Back</button>
        </div>
      </div>
    </Transition>
  </div>
</template>
