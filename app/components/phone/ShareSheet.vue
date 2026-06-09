<script setup lang="ts">
const { open, tab, hide } = useShareSheet()
const { shareUrl } = useShare()
const { success } = useToast()

interface MyCard { id: string; url: string; name: string; title: string | null; company: string | null }

const card = ref<MyCard | null>(null)
const invite = ref<{ code: string; url: string } | null>(null)
const qr = reactive<{ card: string; invite: string }>({ card: '', invite: '' })
const busy = ref(false)

async function makeQr(url: string) {
  const QR = await import('qrcode')
  return QR.toDataURL(url, { margin: 1, width: 260, color: { dark: '#060810', light: '#ffffff' } })
}

async function ensureCard() {
  if (card.value) return
  busy.value = true
  try {
    card.value = await $fetch<MyCard>('/api/cards/me')
    qr.card = await makeQr(card.value.url)
  } catch { /* surfaced via empty state */ } finally { busy.value = false }
}
async function ensureInvite() {
  if (invite.value) return
  busy.value = true
  try {
    invite.value = await $fetch<{ code: string; url: string }>('/api/invite')
    qr.invite = await makeQr(invite.value.url)
  } catch { /* */ } finally { busy.value = false }
}

// Load whichever tab is shown (and when the user switches tabs).
watch([open, tab], ([isOpen, t]) => {
  if (!isOpen) return
  if (t === 'card') ensureCard()
  else ensureInvite()
}, { immediate: true })

function editCard() {
  hide()
  navigateTo('/card/edit')
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
</script>

<template>
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
        <template v-else>
          <div class="cd-sheet-qrbox"><img v-if="qr.card" :src="qr.card" alt="Your card QR" width="220" height="220" /></div>
          <div v-if="card" style="margin: 4px 0 12px">
            <div style="font-size: 16px; font-weight: 800">{{ card.name }}</div>
            <div style="font-size: 12px; color: var(--cd-dim)">{{ [card.title, card.company].filter(Boolean).join(' · ') || 'CardDesk' }}</div>
          </div>
          <button class="cd-abtn g" style="margin-bottom: 8px" @click="shareMyCard"><CdIcon emoji="📤" icon="lucide:share" :size="14" /> Share my card</button>
          <button class="cd-abtn" style="background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr)" @click="editCard"><CdIcon emoji="✏️" icon="lucide:pencil" :size="13" /> Edit my card</button>
        </template>
      </template>

      <!-- Invite -->
      <template v-else>
        <div class="cd-sheet-sub">Scan in person, or share the link to grow your network.</div>
        <div v-if="busy && !qr.invite" class="cd-sheet-qrbox cd-sheet-loading"><div class="cd-spin" style="font-size: 30px"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="30" /></div></div>
        <template v-else>
          <div class="cd-sheet-qrbox"><img v-if="qr.invite" :src="qr.invite" alt="Invite QR" width="220" height="220" /></div>
          <button class="cd-abtn g" @click="shareInvite"><CdIcon emoji="📤" icon="lucide:share" :size="14" /> Share invite link</button>
        </template>
      </template>
    </div>
  </div>
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
.cd-sheet-loading {
  width: 244px;
  height: 244px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cd-bg2);
}
</style>
