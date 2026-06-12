<script setup lang="ts">
/**
 * Contact-targeted invite options — the same set the ShareSheet "Invite" tab
 * offers (QR, share link, email, message with pre-written content), but built
 * for ONE contact: the link is a contact-targeted invite (deterministic source
 * linking on join), and the email / SMS are pre-addressed to the contact's own
 * email + phone with personalized copy. Embedded in the Orbit popover.
 */
import type { CdContact } from '~/types/directus'

const props = defineProps<{ contact: CdContact }>()

const { mintContactInvite, share } = useInvites()
const { success, info, error: showError } = useToast()

const url = ref('')
const qr = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  url.value = ''
  qr.value = ''
  try {
    const res = await mintContactInvite(props.contact.id)
    url.value = res.url
    const QR = await import('qrcode')
    qr.value = await QR.toDataURL(res.url, { margin: 1, width: 220, color: { dark: '#060810', light: '#ffffff' } })
  } catch (err: any) {
    showError(err?.data?.message || 'Couldn’t create an invite link.')
  } finally {
    loading.value = false
  }
}

const firstName = computed(() => props.contact.first_name || props.contact.name?.split(' ')[0] || '')
const greeting = computed(() => (firstName.value ? `Hey ${firstName.value}` : 'Hey'))
const msg = computed(() =>
  url.value ? `${greeting.value}! I'm on CardDesk — it's how I keep up with the people I meet. Connect with me so we stay in touch: ${url.value}` : '',
)
const mailto = computed(() => {
  const subject = "Let's connect on CardDesk"
  const body = `${greeting.value},\n\nI'm using CardDesk to keep up with my network, and I'd love to stay connected with you.\n\nTap here to connect with me:\n${url.value}\n\nTalk soon!`
  return `mailto:${encodeURIComponent(props.contact.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})
// Strip spaces/dashes/parens so the dialer gets a clean number (keep digits + leading +).
const smsTo = computed(() => (props.contact.phone || '').replace(/[^\d+]/g, ''))
const sms = computed(() => `sms:${smsTo.value}?&body=${encodeURIComponent(msg.value)}`)

async function shareLink() {
  if (!url.value) return
  const how = await share(url.value, msg.value)
  if (how === 'copied') success('Invite link copied!')
  else if (how === 'failed') info('Couldn’t share — try the QR or email.')
}

onMounted(load)
watch(() => props.contact.id, load)
</script>

<template>
  <div class="civ">
    <div v-if="loading" class="civ-dim">Preparing invite…</div>
    <template v-else-if="url">
      <div class="civ-target">
        <CdIcon emoji="🎯" icon="lucide:target" :size="12" />
        <span>Personalized for <strong>{{ contact.name || firstName || 'this contact' }}</strong><template v-if="contact.email"> · {{ contact.email }}</template> — links them to this contact when they join.</span>
      </div>
      <div class="civ-sub">Scan in person, or send it their way 👇</div>
      <div class="civ-qr"><img v-if="qr" :src="qr" alt="Invite QR" width="200" height="200" /></div>
      <button class="cd-abtn g" style="margin-bottom: 8px" @click="shareLink"><CdIcon emoji="📤" icon="lucide:share" :size="14" /> Share invite link</button>
      <div class="civ-row">
        <a v-if="contact.email" class="cd-abtn civ-act" :href="mailto"><CdIcon emoji="📧" icon="lucide:mail" :size="14" /> Email</a>
        <a v-if="contact.phone" class="cd-abtn civ-act" :href="sms"><CdIcon emoji="💬" icon="lucide:message-circle" :size="14" /> Message</a>
      </div>
      <div v-if="!contact.email && !contact.phone" class="civ-hint">No email or phone on file — share the link or QR instead.</div>
    </template>
    <div v-else class="civ-dim">Couldn’t create an invite link. <button class="civ-retry" @click="load">Retry</button></div>
  </div>
</template>

<style scoped>
.civ { display: flex; flex-direction: column; }
.civ-dim { font-size: 12px; color: var(--cd-muted); padding: 14px 0; text-align: center; }
.civ-retry { background: none; border: 0; color: var(--cd-accent); cursor: pointer; font-family: inherit; text-decoration: underline; }
.civ-target {
  display: flex; align-items: flex-start; gap: 6px; font-size: 11.5px; line-height: 1.35;
  color: var(--cd-accent); background: color-mix(in srgb, var(--cd-accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 28%, transparent);
  border-radius: 10px; padding: 7px 10px; margin-bottom: 10px;
}
.civ-target strong { font-weight: 700; }
.civ-sub { font-size: 12px; color: var(--cd-dim); margin-bottom: 10px; }
.civ-qr {
  background: #fff; border-radius: 14px; padding: 10px; display: inline-block; margin: 0 auto 12px;
}
.civ-qr img { display: block; }
.civ-row { display: flex; gap: 8px; }
.civ-act {
  flex: 1; background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); text-decoration: none;
}
.civ-hint { margin-top: 8px; font-size: 11.5px; color: var(--cd-dim); text-align: center; }
</style>
