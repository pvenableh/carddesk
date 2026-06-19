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

/**
 * `placement` splits this widget across the detail page:
 *  - 'header' renders only the compact "Introduced by" pill (lives in the hero
 *    tag row).
 *  - 'footer' (default) renders the invite/share buttons, source, and the
 *    "led to" referrals — the cleaned-up Source & referrals card at the bottom.
 */
const props = defineProps<{ contact: CdContact; placement?: 'header' | 'footer' }>()
const place = computed(() => props.placement ?? 'footer')

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
// A bottom-sheet picker (rather than an inline <select>, which reflowed the hero
// tag row + the coach tabs below it when it expanded).
const pickerOpen = ref(false)
const pickSearch = ref('')
const saving = ref(false)

const filteredPickable = computed(() => {
  const term = pickSearch.value.trim().toLowerCase()
  if (!term) return pickable.value
  return pickable.value.filter((c) =>
    [c.name, c.company, c.title].filter(Boolean).join(' ').toLowerCase().includes(term),
  )
})

function openPicker() {
  pickSearch.value = ''
  pickerOpen.value = true
}

async function choose(id: string) {
  saving.value = true
  try {
    await updateContact(props.contact.id, { referred_by: id, source: 'referral' } as any)
    pickerOpen.value = false
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
  <!-- Header variant: just the compact "Introduced by" pill for the hero tag row.
       Setting it opens a bottom-sheet picker (Teleported to <body>) so the
       selector never reflows the hero tags or the coach tabs below. -->
  <template v-if="place === 'header'">
    <template v-if="referrer">
      <button class="rf-by" type="button" title="Introduced by — tap to open" @click="goDetail(referrer.id)">
        <CdIcon icon="lucide:corner-down-right" :size="10" />
        <span class="rf-by-nm">{{ referrer.name }}</span>
      </button>
      <button class="rf-by-x" type="button" aria-label="Clear who introduced them" @click="clearReferrer"><CdIcon icon="lucide:x" :size="11" /></button>
    </template>
    <button v-else class="rf-by-add" type="button" title="Set who introduced this contact" @click="openPicker">
      <CdIcon icon="lucide:corner-down-right" :size="10" /> Introduced by
    </button>

    <Teleport to="body">
      <Transition name="cd-pop">
        <div v-if="pickerOpen" class="rf-sheet-ov" @click.self="pickerOpen = false">
          <div class="rf-sheet" role="dialog" aria-modal="true">
            <div class="rf-sheet-hd">Who introduced you to {{ contact.name }}?</div>
            <div class="rf-sheet-sub">Pick the contact who connected you.</div>
            <input v-model="pickSearch" class="cd-inp rf-sheet-search" type="search" placeholder="Search your contacts…" />
            <div class="rf-sheet-list">
              <button
                v-for="c in filteredPickable"
                :key="c.id"
                type="button"
                class="rf-sheet-row"
                :disabled="saving"
                @click="choose(c.id)"
              >
                <span class="rf-sheet-nm">{{ c.name }}</span>
                <span v-if="c.company || c.title" class="rf-sheet-meta">{{ [c.title, c.company].filter(Boolean).join(' · ') }}</span>
              </button>
              <div v-if="!filteredPickable.length" class="rf-sheet-empty">No matching contacts.</div>
            </div>
            <button type="button" class="cd-abtn rf-sheet-cancel" @click="pickerOpen = false">Cancel</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </template>

  <!-- Footer variant: just the invite/share buttons + description (no card chrome
       or title), with source / led-to surfaced plainly only when present. -->
  <div v-else class="rf-foot">
    <!-- Invite -->
    <div class="rf-invite">
      <div v-if="joined" class="rf-joined"><CdIcon icon="lucide:badge-check" :size="14" /> On CardDesk — connected</div>
      <template v-else>
        <div class="rf-invite-row">
          <button v-if="hasEmail" class="cd-abtn g" type="button" :disabled="sending" @click="emailInvite">
            <CdIcon :icon="sending ? 'lucide:loader-2' : 'lucide:mail'" :size="14" :class="{ 'rf-spin': sending }" />
            {{ invitedEmail ? 'Resend invite' : 'Invite to CardDesk' }}
          </button>
          <button class="cd-abtn rf-ghost" type="button" @click="shareLink">
            <CdIcon icon="lucide:link" :size="14" /> Share my link
          </button>
        </div>
        <div v-if="hasEmail && !invitedEmail" class="rf-target">
          <CdIcon icon="lucide:target" :size="11" />
          <span><strong>Invite to CardDesk</strong> is personalized for {{ contact.name }} — links them to this contact when they join. <em>Share my link</em> is your general invite.</span>
        </div>
        <div v-if="invitedEmail" class="rf-sent"><CdIcon icon="lucide:check" :size="12" /> Invite emailed to {{ invitedEmail }}</div>
        <div v-else-if="!hasEmail" class="rf-hint">Add an email to send a one-click invite — or share your link.</div>
      </template>
    </div>

    <!-- Provenance — source + who this contact led to (introduced-by lives in the header). -->
    <div v-if="referrals.length || sourceMeta" class="rf-prov">
      <div v-if="referrals.length" class="rf-line">
        <span class="rf-k">Led to</span>
        <div class="rf-chips">
          <button v-for="c in referrals" :key="c.id" class="cd-pill on" type="button" @click="goDetail(c.id)">{{ c.name }}</button>
        </div>
      </div>
      <div v-if="sourceMeta" class="rf-line">
        <span class="rf-k">Source</span>
        <span class="cd-pill"><CdIcon :icon="sourceMeta.icon" :size="11" /> {{ sourceMeta.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rf-foot { margin-bottom: 8px; }

.rf-invite { margin-bottom: 12px; }
.rf-joined {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;
  color: var(--cd-green, #00ff87); background: color-mix(in srgb, var(--cd-green, #00ff87) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-green, #00ff87) 30%, transparent); border-radius: 9999px; padding: 6px 12px;
}
/* Invite + share side by side; wrap to stacked only when too narrow to fit. */
.rf-invite-row { display: flex; flex-wrap: wrap; gap: 8px; }
.rf-invite-row .cd-abtn { flex: 1 1 140px; }
.rf-ghost { background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); }

/* ── Header "Introduced by" pill (placement="header") ── */
.rf-by {
  display: inline-flex; align-items: center; gap: 4px; max-width: 170px;
  font-size: 10px; font-weight: 700; padding: 2px 9px; border-radius: 9999px;
  border: 1px solid var(--cd-bdr); background: var(--cd-bg2); color: var(--cd-muted);
  cursor: pointer; font-family: inherit;
}
.rf-by:hover { color: var(--cd-text); border-color: var(--cd-muted); }
.rf-by-nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-by-x { background: none; border: 0; color: var(--cd-dim); cursor: pointer; padding: 1px; display: inline-flex; align-items: center; }
.rf-by-x:hover { color: #e5484d; }
/* Dashed placeholder — mirrors the hero's "+ Pipeline" / "Goal" empty affordances. */
.rf-by-add {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; font-weight: 700; color: var(--cd-dim);
  background: none; border: 1px dashed var(--cd-bdr); border-radius: 6px; padding: 2px 8px;
  cursor: pointer; font-family: inherit;
}
.rf-by-add:hover { color: var(--cd-muted); border-color: var(--cd-muted); }

/* ── "Introduced by" bottom-sheet picker ── */
.rf-sheet-ov {
  position: fixed; inset: 0; z-index: 200;
  display: flex; align-items: flex-end; justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}
.rf-sheet {
  width: 100%; max-width: 768px; max-height: 72vh;
  display: flex; flex-direction: column; gap: 8px;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 16px 16px 0 0;
  padding: 16px 16px max(16px, env(safe-area-inset-bottom));
}
.rf-sheet-hd { font-size: 14px; font-weight: 800; }
.rf-sheet-sub { font-size: 11px; color: var(--cd-muted); margin-top: -4px; }
.rf-sheet-search { margin: 4px 0 2px; }
.rf-sheet-list { overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.rf-sheet-row {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  padding: 10px 14px; border-radius: 10px; border: 1px solid var(--cd-bdr);
  background: var(--cd-bg); color: var(--cd-text); font-family: inherit;
  font-size: 13px; font-weight: 600; cursor: pointer; transition: border-color 0.15s;
}
.rf-sheet-row:hover { border-color: var(--cd-accent); }
.rf-sheet-row:disabled { opacity: 0.6; cursor: default; }
.rf-sheet-nm { flex-shrink: 0; }
.rf-sheet-meta { margin-left: auto; font-size: 11px; color: var(--cd-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-sheet-empty { font-size: 12px; color: var(--cd-muted); text-align: center; padding: 14px; }
.rf-sheet-cancel { background: transparent; color: var(--cd-muted); border-color: var(--cd-bdr); margin-top: 2px; }
.rf-spin { animation: rf-spin 0.8s linear infinite; }
@keyframes rf-spin { to { transform: rotate(360deg); } }
.rf-target {
  display: flex; align-items: flex-start; gap: 6px; margin-top: 8px;
  font-size: 11px; line-height: 1.35; color: var(--cd-accent);
}
.rf-target strong { font-weight: 700; }
.rf-target em { font-style: normal; font-weight: 600; color: var(--cd-muted); }
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
