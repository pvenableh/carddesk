<script setup lang="ts">
/**
 * Contact "Source & referrals" widget. Two jobs:
 *  1. Invite this contact to CardDesk — a one-click targeted email (deterministic
 *     source link + referral credit on join), with the evergreen share link kept
 *     as a fallback / alternative.
 *  2. Provenance — show/set who introduced this contact (referred_by), list the
 *     contacts THEY introduced, and show how the contact was acquired (source).
 */
import type { CdContact } from '~/types/directus'

const props = defineProps<{ contact: CdContact }>()

const { contacts, updateContact } = useContacts()
const { sendInvite, link, share } = useInvites()
const { goDetail } = useNavigation()
const { success, error: showError, info } = useToast()

const joined = computed(() => !!props.contact.linked_user)
const hasEmail = computed(() => !!props.contact.email)

const referrer = computed(() => contacts.value.find((c) => c.id === props.contact.referred_by) || null)
const referrals = computed(() => contacts.value.filter((c) => c.referred_by === props.contact.id))
const pickable = computed(() =>
  contacts.value
    .filter((c) => c.id !== props.contact.id && c.id !== props.contact.referred_by)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
)

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  scan: { label: 'Scanned', icon: 'lucide:scan-line' },
  manual: { label: 'Added by hand', icon: 'lucide:pencil' },
  referral: { label: 'Referral', icon: 'lucide:share-2' },
  event: { label: 'From an event', icon: 'lucide:radio' },
  import: { label: 'Imported', icon: 'lucide:download' },
}
const sourceMeta = computed(() => (props.contact.source ? SOURCE_META[props.contact.source] : null))

// ── Invite ────────────────────────────────────────────────────────────────
const sending = ref(false)
const invitedEmail = ref<string | null>(null)

async function emailInvite() {
  if (sending.value) return
  // Confirm the recipient before sending an external email — one-click, but never
  // a silent send to the wrong person.
  if (!confirm(`Email a CardDesk invite to ${props.contact.name} at ${props.contact.email}?`)) return
  sending.value = true
  try {
    const r = await sendInvite(props.contact.id)
    if (r.sent) {
      invitedEmail.value = r.email
      success(`Invite emailed to ${r.email}`)
    } else {
      // SendGrid down / not configured — fall back to the personalized link.
      const how = await share(r.url, `Join me on CardDesk`)
      if (how === 'shared') info('Email didn’t send — shared the link instead.')
      else if (how === 'copied') info('Email didn’t send — link copied instead.')
      else showError('Couldn’t send the invite. Try the share link.')
    }
  } catch (e: any) {
    showError(e?.data?.message || 'Couldn’t send the invite — try again.')
  } finally {
    sending.value = false
  }
}

async function shareLink() {
  try {
    const { url } = await link()
    const how = await share(url, 'Join me on CardDesk')
    if (how === 'copied') info('Invite link copied')
  } catch {
    showError('Couldn’t get your invite link.')
  }
}

// ── Provenance ──────────────────────────────────────────────────────────────
const picking = ref(false)
const saving = ref(false)

async function setReferrer(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  if (!id) return
  saving.value = true
  try {
    await updateContact(props.contact.id, { referred_by: id, source: 'referral' } as any)
    picking.value = false
  } catch {
    showError('Couldn’t save that.')
  } finally {
    saving.value = false
  }
}

async function clearReferrer() {
  try {
    await updateContact(props.contact.id, { referred_by: null } as any)
  } catch {
    showError('Couldn’t update that.')
  }
}
</script>

<template>
  <div class="cd-log-sec rf">
    <div class="rf-hd">Source &amp; referrals</div>

    <!-- Invite -->
    <div class="rf-invite">
      <div v-if="joined" class="rf-joined"><CdIcon icon="lucide:badge-check" :size="14" /> On CardDesk — connected</div>
      <template v-else>
        <div class="rf-invite-stack">
          <button v-if="hasEmail" class="cd-abtn g" type="button" :disabled="sending" @click="emailInvite">
            <CdIcon :icon="sending ? 'lucide:loader-2' : 'lucide:mail'" :size="14" :class="{ 'rf-spin': sending }" />
            {{ invitedEmail ? 'Resend invite' : 'Invite to CardDesk' }}
          </button>
          <button class="cd-abtn rf-ghost" type="button" @click="shareLink">
            <CdIcon icon="lucide:link" :size="14" /> Share my link
          </button>
        </div>
        <div v-if="invitedEmail" class="rf-sent"><CdIcon icon="lucide:check" :size="12" /> Invite emailed to {{ invitedEmail }}</div>
        <div v-else-if="!hasEmail" class="rf-hint">Add an email to send a one-click invite — or share your link.</div>
      </template>
    </div>

    <!-- Provenance -->
    <div class="rf-prov">
      <!-- Introduced by -->
      <div class="rf-line">
        <span class="rf-k">Introduced by</span>
        <template v-if="referrer">
          <button class="cd-pill on" type="button" @click="goDetail(referrer.id)">{{ referrer.name }}</button>
          <button class="rf-x" type="button" aria-label="Clear" @click="clearReferrer"><CdIcon icon="lucide:x" :size="12" /></button>
        </template>
        <template v-else-if="picking">
          <select class="cd-inp rf-select" :disabled="saving" @change="setReferrer">
            <option value="">Pick a contact…</option>
            <option v-for="c in pickable" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </template>
        <button v-else class="cd-pill" type="button" @click="picking = true"><CdIcon icon="lucide:plus" :size="12" /> Set</button>
      </div>

      <!-- Referrals made -->
      <div v-if="referrals.length" class="rf-line">
        <span class="rf-k">Led to</span>
        <div class="rf-chips">
          <button v-for="c in referrals" :key="c.id" class="cd-pill on" type="button" @click="goDetail(c.id)">{{ c.name }}</button>
        </div>
      </div>

      <!-- Source -->
      <div v-if="sourceMeta" class="rf-line">
        <span class="rf-k">Source</span>
        <span class="cd-pill"><CdIcon :icon="sourceMeta.icon" :size="11" /> {{ sourceMeta.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rf { margin-bottom: 16px; }
.rf-hd { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: var(--cd-dim); margin-bottom: 10px; }

.rf-invite { margin-bottom: 12px; }
.rf-joined {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
  color: var(--cd-green, #00ff87); background: color-mix(in srgb, var(--cd-green, #00ff87) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-green, #00ff87) 30%, transparent); border-radius: 9999px; padding: 6px 12px;
}
/* Two stacked pill buttons — matches the app's cd-abtn stacking (e.g. ShareSheet). */
.rf-invite-stack { display: flex; flex-direction: column; gap: 8px; }
.rf-ghost { background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); }
.rf-spin { animation: rf-spin 0.8s linear infinite; }
@keyframes rf-spin { to { transform: rotate(360deg); } }
.rf-sent { display: flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 11.5px; color: var(--cd-green, #00ff87); }
.rf-hint { margin-top: 8px; font-size: 11.5px; color: var(--cd-muted); }

.rf-prov { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--cd-bdr); padding-top: 12px; }
.rf-line { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rf-k { font-size: 11px; color: var(--cd-dim); min-width: 86px; }
.rf-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rf-x { background: none; border: 0; color: var(--cd-dim); cursor: pointer; padding: 2px; }
.rf-x:hover { color: #e5484d; }
.rf-select { flex: 1; min-width: 160px; margin-bottom: 0; }
</style>
