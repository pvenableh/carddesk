<script setup lang="ts">
import type { NetworkConnection } from '~/composables/useConnections'
import type { CdContact } from '~/types/directus'
import { SOCIAL_KEYS } from '~/types/socials'
import { industryColor, cEmoji } from '~/composables/useConstants'
import NetworkOrbit from './NetworkOrbit.vue'
import Leaderboard from './Leaderboard.vue'

const { accepted, incoming, outgoing, loading, load, connect, respond, meAvatarUrl } = useConnections()
const { show: openShareSheet } = useShareSheet()
const { success, error: showError } = useToast()
const { state: xp, earn } = useXp()
const { profile } = useProfile()
const { shareContact, shareUrl } = useShare()
const { contacts, fetchContacts, daysSince } = useContacts()
const { goDetail } = useNavigation()

const meCenter = computed(() => ({
  name: [profile.value.first_name, profile.value.last_name].filter(Boolean).join(' ') || 'You',
  level: xp.value?.level ?? 1,
}))

// Everyone you've met rides in the orbit as a dim dot (one network, two
// states); the orbit itself dedupes contacts already linked to a connection.
const orbitContacts = computed(() => contacts.value.filter((c) => !c.hibernated))

// Tapped contact dot → the "light them up" sheet.
const selectedContact = ref<CdContact | null>(null)
function inviteContact() {
  selectedContact.value = null
  openShareSheet('invite')
}
function viewContact() {
  const id = selectedContact.value?.id
  selectedContact.value = null
  if (id) goDetail(id)
}
// They already joined CardDesk (linked on invite redemption) — connect directly.
const connectingLinked = ref(false)
async function connectLinked() {
  const c = selectedContact.value
  if (!c?.linked_user || connectingLinked.value) return
  connectingLinked.value = true
  try {
    await connect(c.linked_user)
    success(`Request sent to ${c.name}`)
    selectedContact.value = null
  } catch { showError('Could not send request') }
  finally { connectingLinked.value = false }
}

// Tapped orbit node → detail sheet
const selected = ref<NetworkConnection | null>(null)
async function removeSelected() {
  if (!selected.value) return
  await respond(selected.value.id, 'remove')
  selected.value = null
}

// Pull the tapped connection's shared card (email/phone/socials) for quick actions.
const selectedCard = ref<any>(null)
watch(selected, async (s) => {
  selectedCard.value = null
  if (!s) return
  try { selectedCard.value = await $fetch(`/api/cards/${s.user.id}`) } catch { /* silent */ }
})
// Is this connection already saved in your contacts (rolodex)? Matched by email.
const contactExists = computed(() => {
  const e = selectedCard.value?.email?.toLowerCase()
  return !!e && contacts.value.some((c) => c.email?.toLowerCase() === e)
})
function cardShareable() {
  const c = selectedCard.value || {}
  const name = c.name || selected.value?.user.name || 'Contact'
  const [first, ...rest] = name.split(' ')
  return {
    name, first_name: first, last_name: rest.join(' '),
    title: c.title ?? selected.value?.user.title ?? null,
    company: c.company ?? null, email: c.email ?? null, phone: c.phone ?? null, website: c.website ?? null,
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, c[k] ?? null])),
  }
}
// Save their card to YOUR phone (vCard → iPhone "Add to Contacts").
async function saveVcard() { await shareContact(cardShareable()) }
// Send their card link to someone else.
async function shareConnection() {
  await shareUrl({ url: `${location.origin}/c/${selected.value?.user.id}`, title: `${selected.value?.user.name} · CardDesk` })
}
// Save them into your CardDesk contacts/CRM — the bridge from connection → contact.
const savingContact = ref(false)
async function addToContacts() {
  if (savingContact.value || !selected.value) return
  savingContact.value = true
  try {
    await $fetch('/api/contacts', { method: 'POST', body: cardShareable() })
    await fetchContacts()
    success(`${selected.value.user.name} added to your contacts`)
  } catch { showError('Could not add to contacts') } finally { savingContact.value = false }
}

// Introduce the selected connection to another of your connections.
const introTargets = computed(() => selected.value ? accepted.value.filter((c) => c.id !== selected.value!.id) : [])
async function introduceTo(other: NetworkConnection) {
  if (!selected.value) return
  const a = selected.value
  try {
    const r = await $fetch<{ existing?: boolean }>('/api/connections/intro', {
      method: 'POST',
      body: { a: a.user.id, b: other.user.id },
    })
    if (r.existing) { showError(`${a.user.name} & ${other.user.name} are already linked`); return }
    earn(50, '🌉', `Introduced ${a.user.name} & ${other.user.name}!`, { intros: (xp.value?.intros ?? 0) + 1 })
    selected.value = null
    load(true)
  } catch { showError('Could not make that intro') }
}

const discoverable = ref(false)
onMounted(async () => {
  load()
  try {
    const r = await $fetch<{ discoverable: boolean }>('/api/network/discoverable')
    discoverable.value = r.discoverable
  } catch { /* silent */ }
})

const empty = computed(() =>
  !loading.value && !accepted.value.length && !incoming.value.length && !outgoing.value.length && !orbitContacts.value.length
)

function openInvite() {
  openShareSheet('invite')
}

// ── Directory search (opt-in) ─────────────────────────────────────────────
const showSearch = ref(false)
const q = ref('')
const results = ref<{ id: string; name: string; title: string | null }[]>([])
const searching = ref(false)
let searchTimer: any
watch(q, (v) => {
  clearTimeout(searchTimer)
  if (v.trim().length < 2) { results.value = []; return }
  searchTimer = setTimeout(runSearch, 300)
})
async function runSearch() {
  searching.value = true
  try {
    const r = await $fetch<{ results: typeof results.value }>('/api/users/search', { query: { q: q.value } })
    results.value = r.results
  } catch { /* silent */ } finally { searching.value = false }
}
async function connectTo(u: { id: string; name: string }) {
  try {
    await connect(u.id)
    results.value = results.value.filter((r) => r.id !== u.id)
    success(`Request sent to ${u.name}`)
  } catch { showError('Could not send request') }
}

async function toggleDiscoverable() {
  const next = !discoverable.value
  discoverable.value = next // optimistic
  try {
    await $fetch('/api/network/discoverable', { method: 'POST', body: { value: next } })
  } catch {
    discoverable.value = !next
    showError('Could not update visibility')
  }
}

// ── Connection actions ────────────────────────────────────────────────────
async function accept(c: NetworkConnection) { await respond(c.id, 'accept'); earn(15, '🤝', `Connected with ${c.user.name}!`) }
async function decline(c: NetworkConnection) { await respond(c.id, 'decline') }
async function remove(c: NetworkConnection) { await respond(c.id, 'remove') }
</script>

<template>
  <div class="cd-scrl" style="padding: 4px var(--cd-gutter) 12px">
    <div class="cd-foot-fill">
    <!-- Actions -->
    <div style="display: flex; gap: 8px; margin-bottom: 12px">
      <button class="cd-abtn g" style="font-size: 13px; padding: 11px" @click="openInvite">
        <CdIcon emoji="🔗" icon="lucide:link" :size="14" /> Share invite
      </button>
      <button class="cd-abtn b" style="font-size: 13px; padding: 11px" @click="showSearch = !showSearch">
        <CdIcon emoji="🔍" icon="lucide:search" :size="14" /> Find people
      </button>
    </div>

    <!-- Search panel -->
    <Transition name="cd-reveal">
    <div v-if="showSearch" class="cd-reveal-panel" style="background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 14px; padding: 12px; margin-bottom: 14px">
      <input v-model="q" class="cd-inp" placeholder="Search by name or email…" style="margin-bottom: 8px" />
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px">
        <span style="font-size: 11px; color: var(--cd-dim)">Let others find you by name/email</span>
        <button
          class="cd-abtn"
          :class="discoverable ? 'g' : ''"
          style="width: auto; font-size: 11px; padding: 5px 12px"
          :style="discoverable ? '' : 'background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)'"
          @click="toggleDiscoverable"
        >{{ discoverable ? 'Discoverable ✓' : 'Off' }}</button>
      </div>
      <div v-if="searching" style="font-size: 12px; color: var(--cd-dim); padding: 6px 0">Searching…</div>
      <div v-else-if="q.trim().length >= 2 && !results.length" style="font-size: 12px; color: var(--cd-dim); padding: 6px 0">
        No discoverable users match “{{ q }}”.
      </div>
      <div v-for="u in results" :key="u.id" class="cd-crd" style="margin-top: 6px">
        <div class="cd-cav"><CdIcon emoji="👤" icon="lucide:user" :size="19" /></div>
        <div style="flex: 1; min-width: 0">
          <div class="cd-cnm">{{ u.name }}</div>
          <div class="cd-csb">{{ u.title || 'CardDesk user' }}</div>
        </div>
        <button class="cd-abtn g" style="width: auto; font-size: 11px; padding: 6px 12px; flex-shrink: 0" @click="connectTo(u)">Connect</button>
      </div>
    </div>
    </Transition>

    <!-- Incoming requests -->
    <template v-if="incoming.length">
      <div class="cd-eyebrow" style="color: var(--cd-muted); margin: 4px 2px 8px">Requests · {{ incoming.length }}</div>
      <div v-for="c in incoming" :key="c.id" class="cd-crd">
        <div class="cd-cav"><CdIcon emoji="👤" icon="lucide:user" :size="19" /></div>
        <div style="flex: 1; min-width: 0">
          <div class="cd-cnm">{{ c.user.name }}</div>
          <div class="cd-csb">{{ c.user.title || 'wants to connect' }}</div>
        </div>
        <div style="display: flex; gap: 6px; flex-shrink: 0">
          <button class="cd-abtn g" style="width: auto; font-size: 11px; padding: 6px 11px" @click="accept(c)">Accept</button>
          <button class="cd-abtn" style="width: auto; font-size: 11px; padding: 6px 10px; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)" @click="decline(c)">×</button>
        </div>
      </div>
    </template>

    <!-- The orbit — connection planets + contact dots — and the leaderboard -->
    <template v-if="accepted.length || orbitContacts.length">
      <div class="cd-eyebrow" style="color: var(--cd-muted); margin: 14px 2px 0">Your orbit</div>
      <NetworkOrbit
        :connections="accepted"
        :contacts="orbitContacts"
        :me="meCenter"
        :me-avatar-url="meAvatarUrl"
        @select="selected = $event"
        @select-contact="selectedContact = $event"
      />
      <div v-if="orbitContacts.length" class="orbit-hint">
        <CdIcon icon="lucide:sparkles" :size="10" />
        Dim dots are your contacts — tap one to light them up.
      </div>
      <Leaderboard v-if="accepted.length" />
    </template>

    <!-- Outgoing pending -->
    <template v-if="outgoing.length">
      <div class="cd-eyebrow" style="color: var(--cd-muted); margin: 14px 2px 8px">Pending · {{ outgoing.length }}</div>
      <div v-for="c in outgoing" :key="c.id" class="cd-crd" style="opacity: 0.7">
        <div class="cd-cav"><CdIcon emoji="👤" icon="lucide:user" :size="19" /></div>
        <div style="flex: 1; min-width: 0">
          <div class="cd-cnm">{{ c.user.name }}</div>
          <div class="cd-csb">Request sent</div>
        </div>
        <button class="cd-abtn" style="width: auto; font-size: 11px; padding: 6px 11px; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); flex-shrink: 0" @click="remove(c)">Cancel</button>
      </div>
    </template>

    <!-- Empty -->
    <div v-if="empty" class="cd-empty">
      <div style="font-size: 40px; margin-bottom: 10px"><CdIcon emoji="🪐" icon="lucide:orbit" :size="40" /></div>
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 6px">Build your network</div>
      <div style="font-size: 12px; color: var(--cd-dim); margin-bottom: 14px; max-width: 240px">
        Share your invite link or find people you know on CardDesk.
      </div>
      <button class="cd-abtn g" style="width: auto; padding: 11px 20px" @click="openInvite"><CdIcon emoji="🔗" icon="lucide:link" :size="14" /> Share invite</button>
    </div>

    <!-- Orbit node detail sheet -->
    <div v-if="selected" class="cd-invite-ov" @click.self="selected = null">
      <div class="cd-invite-card">
        <button class="cd-invite-x" @click="selected = null"><CdIcon emoji="×" icon="lucide:x" :size="18" /></button>
        <div class="cd-cav" style="margin: 0 auto 10px; width: 54px; height: 54px; background: rgba(0,255,135,0.1); overflow: hidden">
          <img v-if="selected.user.avatarUrl" :src="selected.user.avatarUrl" alt="" style="width: 100%; height: 100%; object-fit: cover">
          <CdIcon v-else emoji="🤝" icon="lucide:user-check" :size="24" />
        </div>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 2px">{{ selected.user.name }}</div>
        <div style="font-size: 12px; color: var(--cd-dim); margin-bottom: 10px">{{ selected.user.title || 'Connected on CardDesk' }}</div>
        <div
          v-if="industryColor(selected.user.industry)"
          style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-bottom: 14px"
          :style="{ color: industryColor(selected.user.industry)!, background: industryColor(selected.user.industry)! + '22', border: '1px solid ' + industryColor(selected.user.industry)! + '66' }"
        >
          <span style="width: 7px; height: 7px; border-radius: 50%" :style="{ background: industryColor(selected.user.industry)! }"></span>
          {{ selected.user.industry }}
        </div>

        <!-- Quick actions from their shared card -->
        <div class="cd-qa-row">
          <a v-if="selectedCard?.email" class="cd-qa" :href="`mailto:${selectedCard.email}`"><CdIcon emoji="✉️" icon="lucide:mail" :size="18" /><span>Email</span></a>
          <a v-if="selectedCard?.phone" class="cd-qa" :href="`tel:${selectedCard.phone}`"><CdIcon emoji="📞" icon="lucide:phone" :size="18" /><span>Call</span></a>
          <button class="cd-qa" @click="saveVcard"><CdIcon emoji="📇" icon="lucide:contact" :size="18" /><span>Save</span></button>
          <button class="cd-qa" @click="shareConnection"><CdIcon emoji="📤" icon="lucide:share-2" :size="18" /><span>Share</span></button>
        </div>

        <!-- Connection → contact bridge -->
        <button
          v-if="!contactExists"
          class="cd-abtn"
          style="margin-bottom: 10px; background: transparent; color: var(--cd-accent); border-color: rgba(0,255,135,0.4)"
          :disabled="savingContact"
          @click="addToContacts"
        ><CdIcon emoji="➕" icon="lucide:user-plus" :size="14" /> {{ savingContact ? 'Adding…' : 'Add to my contacts' }}</button>
        <div v-else style="display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:var(--cd-green);font-weight:700;margin-bottom:10px">
          <CdIcon emoji="✓" icon="lucide:check" :size="13" /> In your contacts
        </div>

        <template v-if="introTargets.length">
          <div class="cd-eyebrow" style="color: var(--cd-muted); text-align: left; margin-bottom: 6px"><CdIcon emoji="🌉" icon="lucide:git-merge" :size="11" /> Introduce to · +50 XP</div>
          <div style="max-height: 160px; overflow-y: auto; margin-bottom: 12px">
            <button v-for="t in introTargets" :key="t.id" class="cd-intro-row" @click="introduceTo(t)">
              <span style="flex: 1; text-align: left; font-size: 13px; font-weight: 700">{{ t.user.name }}</span>
              <CdIcon emoji="→" icon="lucide:arrow-right" :size="14" />
            </button>
          </div>
        </template>

        <button class="cd-abtn" style="background: transparent; color: #ff6b35; border-color: rgba(255,107,53,0.4)" @click="removeSelected"><CdIcon emoji="🗑️" icon="lucide:user-minus" :size="14" /> Remove connection</button>
      </div>
    </div>

    <!-- Contact-dot sheet — the "light them up" upgrade path -->
    <div v-if="selectedContact" class="cd-invite-ov" @click.self="selectedContact = null">
      <div class="cd-invite-card">
        <button class="cd-invite-x" @click="selectedContact = null"><CdIcon emoji="×" icon="lucide:x" :size="18" /></button>
        <div class="cd-cav" style="margin: 0 auto 10px; width: 54px; height: 54px; overflow: hidden">
          <img v-if="selectedContact.imageUrl" :src="selectedContact.imageUrl" alt="" style="width: 100%; height: 100%; object-fit: cover">
          <CdIcon v-else :emoji="cEmoji(selectedContact)" icon="lucide:user" :size="24" />
        </div>
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 2px">{{ selectedContact.name }}</div>
        <div style="font-size: 12px; color: var(--cd-dim); margin-bottom: 12px">
          {{ [selectedContact.title, selectedContact.company].filter(Boolean).join(' · ') || 'In your contacts' }}
          <template v-if="daysSince(selectedContact) != null"> · {{ daysSince(selectedContact) }}d quiet</template>
        </div>

        <button
          v-if="selectedContact.linked_user"
          class="cd-abtn g"
          style="margin-bottom: 8px"
          :disabled="connectingLinked"
          @click="connectLinked"
        ><CdIcon emoji="🪐" icon="lucide:orbit" :size="14" /> {{ connectingLinked ? 'Sending…' : "They're on CardDesk — connect" }}</button>
        <button
          v-else
          class="cd-abtn g"
          style="margin-bottom: 8px"
          @click="inviteContact"
        ><CdIcon emoji="✨" icon="lucide:sparkles" :size="14" /> Invite them</button>

        <button
          class="cd-abtn"
          style="background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)"
          @click="viewContact"
        ><CdIcon emoji="👤" icon="lucide:user" :size="14" /> View contact</button>
      </div>
    </div>

    </div>

    <CdBrandFooter />
  </div>
</template>

<style scoped>
.orbit-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  color: var(--cd-dim);
  margin: 2px 0 10px;
}
.cd-invite-ov {
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
.cd-intro-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 11px;
  margin-bottom: 4px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 10px;
  color: var(--cd-text);
  cursor: pointer;
}
.cd-intro-row:hover { border-color: var(--cd-accent); color: var(--cd-accent); }
.cd-invite-card {
  position: relative;
  background: var(--cd-bg);
  border: 1px solid var(--cd-bdr);
  border-radius: 20px;
  padding: 24px;
  text-align: center;
  max-width: 320px;
  width: 100%;
}
.cd-invite-x {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--cd-dim);
  cursor: pointer;
}

/* Connection quick actions */
.cd-qa-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.cd-qa {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  color: var(--cd-text);
  font-size: 10px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.cd-qa:hover { border-color: var(--cd-accent); color: var(--cd-accent); }
.cd-qa:active { transform: scale(0.96); }

/* Smooth reveal for the Find People search panel */
.cd-reveal-enter-active,
.cd-reveal-leave-active {
  transition: max-height 0.28s ease, opacity 0.22s ease, margin-bottom 0.28s ease, padding-top 0.28s ease, padding-bottom 0.28s ease;
  overflow: hidden;
}
.cd-reveal-enter-from,
.cd-reveal-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}
.cd-reveal-enter-to,
.cd-reveal-leave-from {
  max-height: 420px;
  opacity: 1;
}
</style>
