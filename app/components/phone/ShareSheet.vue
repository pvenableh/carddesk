<script setup lang="ts">
import { SOCIALS, socialUrl } from '~/types/socials'

const { open, tab, hide } = useShareSheet()
const { shareUrl } = useShare()
const { success } = useToast()

interface MyCard { id: string; url: string; name: string; title: string | null; company: string | null; [key: string]: any }

const card = ref<MyCard | null>(null)
const cardSocials = computed(() => (card.value ? SOCIALS.filter((s) => (card.value as any)[s.key]) : []))
const invite = ref<{ code: string; url: string } | null>(null)
const qr = reactive<{ card: string; invite: string }>({ card: '', invite: '' })
const busy = ref(false)

async function makeQr(url: string) {
  const QR = await import('qrcode')
  return QR.toDataURL(url, { margin: 1, width: 260, color: { dark: '#060810', light: '#ffffff' } })
}

// Load failures used to leave the spinner up forever — surface them with a retry.
const loadError = reactive<{ card: boolean; invite: boolean }>({ card: false, invite: false })

async function ensureCard() {
  if (card.value) return
  busy.value = true
  loadError.card = false
  try {
    card.value = await $fetch<MyCard>('/api/cards/me')
    qr.card = await makeQr(card.value.url)
  } catch { loadError.card = true } finally { busy.value = false }
}
async function ensureInvite() {
  if (invite.value) return
  busy.value = true
  loadError.invite = false
  try {
    invite.value = await $fetch<{ code: string; url: string }>('/api/invite')
    qr.invite = await makeQr(invite.value.url)
  } catch { loadError.invite = true } finally { busy.value = false }
}

// Load whichever tab is shown (and when the user switches tabs).
watch([open, tab], ([isOpen, t]) => {
  if (!isOpen) return
  if (t === 'card') ensureCard()
  else ensureInvite()
}, { immediate: true })

function editCard() {
  hide()
  navigateTo('/account?tab=card')
}
async function shareMyCard() {
  if (!card.value) return
  const res = await shareUrl({ url: card.value.url, title: `${card.value.name} · CardDesk`, text: 'Here’s my CardDesk card' })
  if (res === 'copied') success('Card link copied!')
}
async function shareInvite() {
  if (!invite.value) return
  const res = await shareUrl({ url: invite.value.url, title: 'Join me on CardDesk', text: 'Connect with me on CardDesk 🎴' })
  if (res === 'copied') success('Invite link copied!')
}

// Prebuilt invite content for the email + message buttons. The recipient just
// has to tap "send" — the subject, body, and link are all filled in.
const inviteMsg = computed(() =>
  invite.value
    ? `Hey! I'm on CardDesk — it's how I keep my network organized. Let's connect so we stay in touch: ${invite.value.url}`
    : ''
)
const inviteMailto = computed(() =>
  'mailto:?subject=' + encodeURIComponent("Let's connect on CardDesk") + '&body=' + encodeURIComponent(
    `Hey,\n\nI'm using CardDesk to keep my network organized, and I'd love to add you.\n\nTap here to connect with me:\n${invite.value?.url ?? ''}\n\nTalk soon!`
  )
)
const inviteSms = computed(() => 'sms:?&body=' + encodeURIComponent(inviteMsg.value))
</script>

<template>
  <Transition name="cd-sheet">
  <div v-if="open" class="cd-sheet-ov" @click.self="hide">
    <div class="cd-sheet-card">
      <button class="cd-sheet-x" @click="hide"><CdIcon emoji="×" icon="lucide:x" :size="18" /></button>

      <div class="cd-sheet-tabs">
        <button :class="{ on: tab === 'card' }" @click="tab = 'card'">My Card</button>
        <button :class="{ on: tab === 'invite' }" @click="tab = 'invite'">Invite</button>
      </div>

      <!-- My Card -->
      <template v-if="tab === 'card'">
        <div class="cd-sheet-sub">Scan to view your card &amp; save your contact.</div>
        <div v-if="busy && !qr.card" class="cd-sheet-qrbox cd-sheet-loading"><div class="cd-spin" style="font-size: 30px"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="30" /></div></div>
        <div v-else-if="loadError.card && !card" class="cd-sheet-err">
          <CdIcon emoji="📡" icon="lucide:wifi-off" :size="22" />
          <div>Couldn't load your card — connection hiccup.</div>
          <button class="cd-abtn g" style="font-size: 12px; padding: 8px 14px" @click="ensureCard">
            <CdIcon emoji="🔄" icon="lucide:refresh-cw" :size="12" /> Try again
          </button>
        </div>
        <template v-else>
          <div class="cd-sheet-qrbox"><img v-if="qr.card" :src="qr.card" alt="Your card QR" width="220" height="220" /></div>
          <div v-if="card" style="margin: 4px 0 12px">
            <div style="font-size: 16px; font-weight: 800">{{ card.name }}</div>
            <div style="font-size: 12px; color: var(--cd-dim)">{{ [card.title, card.company].filter(Boolean).join(' · ') || 'CardDesk' }}</div>
            <div v-if="cardSocials.length" class="cd-sheet-socials">
              <a v-for="s in cardSocials" :key="s.key" :href="socialUrl(s.key, (card as any)[s.key])" target="_blank" rel="noopener" :aria-label="s.label"><Icon :name="s.icon" :size="20" /></a>
            </div>
          </div>
          <a v-if="card" class="cd-abtn g" style="margin-bottom: 8px; text-decoration: none" :href="card.url" target="_blank" rel="noopener"><CdIcon emoji="👁" icon="lucide:external-link" :size="14" /> View my card</a>
          <button class="cd-abtn" style="background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); margin-bottom: 8px" @click="shareMyCard"><CdIcon emoji="📤" icon="lucide:share" :size="14" /> Share my card</button>
          <button class="cd-abtn" style="background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)" @click="editCard"><CdIcon emoji="✏️" icon="lucide:pencil" :size="13" /> Edit my card</button>
        </template>
      </template>

      <!-- Invite -->
      <template v-else>
        <div class="cd-sheet-sub">Scan in person, or share the link to grow your network.</div>
        <div v-if="busy && !qr.invite" class="cd-sheet-qrbox cd-sheet-loading"><div class="cd-spin" style="font-size: 30px"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="30" /></div></div>
        <div v-else-if="loadError.invite && !invite" class="cd-sheet-err">
          <CdIcon emoji="📡" icon="lucide:wifi-off" :size="22" />
          <div>Couldn't load your invite link — connection hiccup.</div>
          <button class="cd-abtn g" style="font-size: 12px; padding: 8px 14px" @click="ensureInvite">
            <CdIcon emoji="🔄" icon="lucide:refresh-cw" :size="12" /> Try again
          </button>
        </div>
        <template v-else>
          <div class="cd-sheet-qrbox"><img v-if="qr.invite" :src="qr.invite" alt="Invite QR" width="220" height="220" /></div>
          <button class="cd-abtn g" style="margin-bottom: 8px" @click="shareInvite"><CdIcon emoji="📤" icon="lucide:share" :size="14" /> Share invite link</button>
          <div class="cd-invite-actions">
            <a class="cd-abtn cd-invite-act" :href="inviteMailto"><CdIcon emoji="📧" icon="lucide:mail" :size="14" /> Email</a>
            <a class="cd-abtn cd-invite-act" :href="inviteSms"><CdIcon emoji="💬" icon="lucide:message-circle" :size="14" /> Message</a>
          </div>
        </template>
      </template>
    </div>
  </div>
  </Transition>
</template>

<style scoped>
.cd-sheet-ov {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 200;
}
/* Smooth open/close: fade the scrim, slide + scale the card up. */
.cd-sheet-enter-active,
.cd-sheet-leave-active {
  transition: opacity 0.2s ease;
}
.cd-sheet-enter-active .cd-sheet-card,
.cd-sheet-leave-active .cd-sheet-card {
  transition: transform 0.26s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.26s ease;
}
.cd-sheet-enter-from,
.cd-sheet-leave-to {
  opacity: 0;
}
.cd-sheet-enter-from .cd-sheet-card,
.cd-sheet-leave-to .cd-sheet-card {
  transform: translateY(18px) scale(0.96);
  opacity: 0;
}
.cd-sheet-card {
  position: relative;
  background: var(--cd-bg);
  border: 1px solid var(--cd-bdr);
  border-radius: 20px;
  padding: 22px;
  text-align: center;
  max-width: 320px;
  width: 100%;
}
.cd-sheet-x {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--cd-dim);
  cursor: pointer;
}
.cd-sheet-tabs {
  display: flex;
  gap: 4px;
  background: var(--cd-bg2);
  border-radius: 9999px;
  padding: 4px;
  margin: 4px 0 16px;
}
.cd-sheet-tabs button {
  flex: 1;
  border: none;
  background: none;
  color: var(--cd-muted);
  font-size: 13px;
  font-weight: 700;
  padding: 8px;
  border-radius: 9999px;
  cursor: pointer;
}
.cd-sheet-tabs button.on {
  background: var(--cd-accent);
  color: #060810;
}
.cd-sheet-sub {
  font-size: 12px;
  color: var(--cd-dim);
  margin-bottom: 14px;
}
.cd-sheet-qrbox {
  background: #fff;
  border-radius: 14px;
  padding: 12px;
  display: inline-block;
  margin-bottom: 12px;
}
.cd-sheet-qrbox img { display: block; }
.cd-sheet-socials {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 9px;
}
.cd-sheet-socials a {
  display: inline-flex;
  line-height: 0;
  opacity: 0.95;
  transition: transform 0.12s ease, opacity 0.12s ease;
}
.cd-sheet-socials a:hover { transform: translateY(-1px); opacity: 1; }
.cd-sheet-loading {
  width: 244px;
  height: 244px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cd-bg2);
}
.cd-sheet-err {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 26px 10px;
  font-size: 12.5px;
  color: var(--cd-muted);
}
.cd-sheet-err .cd-abtn { width: auto; }
.cd-invite-actions {
  display: flex;
  gap: 8px;
}
.cd-invite-act {
  flex: 1;
  background: transparent;
  color: var(--cd-muted);
  border-color: var(--cd-bdr);
  text-decoration: none;
}
</style>
