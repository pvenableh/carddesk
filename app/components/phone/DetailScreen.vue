<script setup lang="ts">
import { RATINGS, ACT_TYPES, getRating, getAct, cEmoji } from '~/composables/useConstants'
import { todayStr, fmtFull } from '~/composables/useFormatters'
import confettiLib from 'canvas-confetti'

const { contacts, updateContact, hibernate, logActivity, markResponded, updateActivity, deleteActivity, lastActivity, daysSince, followUpStatus } = useContacts()
const { state: xp, earn, deduct } = useXp()
const { selectedId, editing, nav } = useNavigation()
const { profile } = useProfile()

const selContact = computed(() => contacts.value.find((c) => c.id === selectedId.value) ?? null)

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
  }
  editing.value = true
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

// Share contact
const shareCopied = ref(false)
async function shareContact() {
  const c = selContact.value as any
  if (!c) return
  const lines = [c.name]
  if (c.title || c.company) lines.push([c.title, c.company].filter(Boolean).join(' at '))
  if (c.email) lines.push(`Email: ${c.email}`)
  if (c.phone) lines.push(`Phone: ${c.phone}`)
  const text = lines.join('\n')
  if (navigator.share) {
    try { await navigator.share({ title: c.name, text }) }
    catch (err: any) { if (err.name !== 'AbortError') console.error('Share failed:', err) }
  } else {
    await navigator.clipboard.writeText(text)
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

async function loadSuggestions() {
  if (!selContact.value) return
  const c = selContact.value as any
  sugLoading.value = true; sugError.value = null; suggestions.value = []
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
          <button class="cd-back" @click="nav('contacts')">← Back</button>
          <div class="cd-det-hero">
            <div style="display: flex; align-items: center; gap: 11px; margin-bottom: 10px">
              <div class="cd-det-av"><CdIcon :emoji="cEmoji(selContact)" icon="lucide:user" :size="24" /></div>
              <div>
                <div style="font-family: 'Bebas Neue', sans-serif; font-size: 26px; line-height: 1; margin-bottom: 3px">{{ selContact.name }}</div>
                <div style="font-size: 12px; color: #8898b0">
                  {{ [(selContact as any).title, (selContact as any).company].filter(Boolean).join(' · ') }}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap">
              <span v-if="selContact.rating" class="cd-rpill" :class="selContact.rating">
                <CdIcon :emoji="getRating(selContact.rating)?.emoji ?? ''" :icon="getRating(selContact.rating)?.lucide" :size="10" /> {{ getRating(selContact.rating)?.label }}
              </span>
              <span v-if="(selContact as any).is_client" style="background: rgba(0,255,135,0.12); border: 1px solid rgba(0,255,135,0.3); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: #00ff87">
                <CdIcon emoji="💰" icon="lucide:badge-check" :size="10" /> Client
              </span>
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

          <div class="cd-log-sec" style="margin-bottom: 16px">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
              <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #3e4f68">
                Next Steps
              </div>
              <button
                class="cd-abtn"
                style="font-size: 11px; padding: 5px 10px; background: transparent; border-color: #1c2330; color: #4da6ff"
                :disabled="sugLoading"
                @click="loadSuggestions"
              >
                <CdIcon emoji="🤖" icon="lucide:sparkles" :size="11" />
                {{ sugLoading ? 'Thinking...' : suggestions.length ? 'Refresh' : 'Get AI Ideas' }}
              </button>
            </div>
            <div v-if="sugError" style="font-size: 12px; color: #f87171; margin-bottom: 8px">{{ sugError }}</div>
            <div
              v-for="(s, i) in suggestions"
              :key="i"
              style="background: #0d1018; border: 1px solid #1c2330; border-radius: 12px; padding: 10px 12px; margin-bottom: 8px"
            >
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 3px">{{ s.icon }} {{ s.title }}</div>
              <div style="font-size: 12px; color: #8898b0; line-height: 1.5">{{ s.body }}</div>
            </div>
          </div>

          <div class="cd-log-sec">
            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #3e4f68; margin-bottom: 8px">
              Log a touchpoint
            </div>
            <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px">
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
            <div style="display: flex; gap: 6px">
              <input v-model="actDate" type="date" class="cd-inp" style="flex: 0 0 130px; margin-bottom: 0" />
              <button class="cd-abtn g" style="flex: 1; font-size: 12px; padding: 9px 6px" @click="doLogAct(false)"><CdIcon emoji="✅" icon="lucide:check-circle" :size="12" /> Log +25 XP</button>
              <button class="cd-abtn b" style="flex: 1; font-size: 12px; padding: 9px 6px" @click="doLogAct(true)"><CdIcon emoji="🎉" icon="lucide:party-popper" :size="12" /> Replied! +100</button>
            </div>
          </div>

          <div
            v-for="(act, i) in sortedActs"
            :key="act.id"
            style="display: flex; gap: 9px; margin-bottom: 13px; position: relative"
          >
            <div
              v-if="i < sortedActs.length - 1"
              style="position: absolute; left: 17px; top: 36px; width: 2px; bottom: -13px; background: #1c2330"
            ></div>
            <div class="cd-tl-dot" :class="act.type"><CdIcon :emoji="getAct(act.type).icon" :icon="getAct(act.type).lucide" :size="17" /></div>
            <div style="flex: 1; background: #0d1018; border: 1px solid #1c2330; border-radius: 12px; padding: 10px 12px">
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
                  <button class="cd-abtn" style="font-size: 11px; padding: 6px; background: transparent; color: #8898b0; border-color: #1c2330" @click="cancelEditAct">Cancel</button>
                </div>
              </template>
              <template v-else>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
                  <div style="font-size: 14px; font-weight: 800">{{ act.label }}</div>
                  <div style="display: flex; align-items: center; gap: 6px">
                    <div style="font-size: 10px; color: #3e4f68; font-family: monospace">{{ fmtFull(act.date) }}</div>
                    <button
                      style="background: none; border: none; cursor: pointer; padding: 2px; font-size: 10px; color: #3e4f68"
                      title="Edit"
                      @click="startEditAct(act)"
                    ><CdIcon emoji="✏️" icon="lucide:pencil" :size="10" /></button>
                    <button
                      style="background: none; border: none; cursor: pointer; padding: 2px; font-size: 10px; color: #3e4f68"
                      title="Delete"
                      @click="confirmDeleteId = act.id"
                    ><CdIcon emoji="🗑" icon="lucide:trash-2" :size="10" /></button>
                  </div>
                </div>
                <div v-if="act.note" style="font-size: 12px; color: #8898b0; line-height: 1.5; margin-bottom: 7px">{{ act.note }}</div>
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
                      style="flex: 1; font-size: 11px; padding: 6px; background: transparent; color: #8898b0; border-color: #1c2330"
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
            style="width: 100%; margin: 8px 0; background: rgba(0,255,135,0.08); border-color: rgba(0,255,135,0.3); color: #00ff87; font-size: 14px; padding: 12px; font-weight: 800"
            @click="doMarkClient"
          ><CdIcon emoji="💰" icon="lucide:badge-check" :size="14" /> Mark as Client +200 XP</button>

          <div style="display: flex; gap: 7px; margin: 8px 0 20px">
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: #8898b0; border-color: #1c2330; font-size: 12px; padding: 9px"
              @click="startEdit"
            ><CdIcon emoji="✏️" icon="lucide:pencil" :size="12" /> Edit</button>
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: #8898b0; border-color: #1c2330; font-size: 12px; padding: 9px"
              @click="shareContact"
            ><CdIcon emoji="📤" icon="lucide:share-2" :size="12" /> {{ shareCopied ? 'Copied!' : 'Share' }}</button>
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: #3e4f68; border-color: #1c2330; font-size: 12px; padding: 9px"
              @click="doHibernate(selContact.id)"
            ><CdIcon emoji="😴" icon="lucide:moon" :size="12" /> Hibernate</button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
