<script setup lang="ts">
import { RATINGS, ACT_TYPES, getRating, getAct, cEmoji } from '~/composables/useConstants'
import { todayStr, fmtFull } from '~/composables/useFormatters'
import confettiLib from 'canvas-confetti'

const { contacts, updateContact, hibernate, logActivity, markResponded, lastActivity, daysSince, followUpStatus } = useContacts()
const { state: xp, earn } = useXp()
const { selectedId, editing, nav } = useNavigation()

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
    overdue: { ico: '⚡', cls: 'overdue', title: `${d} days overdue`, sub: `Last: ${la?.label ?? 'Contact'} on ${fmtFull(la?.date)}` },
    due: { ico: '⏰', cls: 'due', title: `${d} days — right on the line`, sub: 'A quick touch now resets the clock.' },
    ok: { ico: '✓', cls: 'ok', title: "You're on top of this one", sub: `Last: ${la?.label ?? 'Contact'} on ${fmtFull(la?.date)}` },
    new: { ico: '👋', cls: 'new', title: 'No activity yet', sub: 'Log your first touchpoint below.' },
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
            >{{ r.emoji }} {{ r.label }}</button>
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
              <div class="cd-det-av">{{ cEmoji(selContact) }}</div>
              <div>
                <div style="font-family: 'Bebas Neue', sans-serif; font-size: 26px; line-height: 1; margin-bottom: 3px">{{ selContact.name }}</div>
                <div style="font-size: 12px; color: #8898b0">
                  {{ [(selContact as any).title, (selContact as any).company].filter(Boolean).join(' · ') }}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap">
              <span v-if="selContact.rating" class="cd-rpill" :class="selContact.rating">
                {{ getRating(selContact.rating)?.emoji }} {{ getRating(selContact.rating)?.label }}
              </span>
              <span v-if="(selContact as any).industry" class="cd-tag-ind">{{ (selContact as any).industry }}</span>
              <span v-if="(selContact as any).met_at" class="cd-tag-ind">@ {{ (selContact as any).met_at }}</span>
            </div>
          </div>

          <div class="cd-fu-banner" :class="followUpStatus(selContact)">
            <span style="font-size: 20px; flex-shrink: 0">{{ fuInfo(selContact)?.ico }}</span>
            <div>
              <div class="cd-fu-t">{{ fuInfo(selContact)?.title }}</div>
              <div class="cd-fu-s">{{ fuInfo(selContact)?.sub }}</div>
            </div>
          </div>

          <div v-if="(selContact as any).email || (selContact as any).phone" class="cd-info-grid">
            <div v-if="(selContact as any).email" class="cd-info-row">
              <span class="cd-info-k">📧</span>
              <a :href="'mailto:' + (selContact as any).email" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).email }}</a>
            </div>
            <div v-if="(selContact as any).phone" class="cd-info-row">
              <span class="cd-info-k">📞</span>
              <a :href="'tel:' + (selContact as any).phone" class="cd-info-v" style="color: #4da6ff">{{ (selContact as any).phone }}</a>
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
                <span style="font-size: 14px; display: block; margin-bottom: 2px">{{ t.icon }}</span>{{ t.label }}
              </button>
            </div>
            <input v-model="actNote" class="cd-inp" placeholder="Quick note..." style="margin-bottom: 7px" />
            <div style="display: flex; gap: 6px">
              <input v-model="actDate" type="date" class="cd-inp" style="flex: 0 0 130px; margin-bottom: 0" />
              <button class="cd-abtn g" style="flex: 1; font-size: 12px; padding: 9px 6px" @click="doLogAct(false)">✅ Log +25 XP</button>
              <button class="cd-abtn b" style="flex: 1; font-size: 12px; padding: 9px 6px" @click="doLogAct(true)">🎉 Replied! +100</button>
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
            <div class="cd-tl-dot" :class="act.type">{{ getAct(act.type).icon }}</div>
            <div style="flex: 1; background: #0d1018; border: 1px solid #1c2330; border-radius: 12px; padding: 10px 12px">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px">
                <div style="font-size: 14px; font-weight: 800">{{ act.label }}</div>
                <div style="font-size: 10px; color: #3e4f68; font-family: monospace">{{ fmtFull(act.date) }}</div>
              </div>
              <div v-if="act.note" style="font-size: 12px; color: #8898b0; line-height: 1.5; margin-bottom: 7px">{{ act.note }}</div>
              <div
                class="cd-tl-resp"
                :class="act.is_response ? 'yes' : 'no'"
                @click="!act.is_response && doMarkResponded(act.id)"
              >
                {{ act.is_response ? '✓ ' + (act.response_note || 'Responded') : '○ No reply — tap to mark' }}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 7px; margin: 8px 0 20px">
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: #8898b0; border-color: #1c2330; font-size: 12px; padding: 9px"
              @click="startEdit"
            >✏️ Edit</button>
            <button
              class="cd-abtn"
              style="flex: 1; background: transparent; color: #3e4f68; border-color: #1c2330; font-size: 12px; padding: 9px"
              @click="doHibernate(selContact.id)"
            >😴 Hibernate</button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
