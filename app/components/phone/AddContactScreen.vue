<script setup lang="ts">
import { RATINGS, INDUSTRIES } from '~/composables/useConstants'
import { SOCIALS, SOCIAL_KEYS } from '~/types/socials'
import { cleanPhones } from '~/types/contact'
import confettiLib from 'canvas-confetti'

const { contacts, createContact, logActivity } = useContacts()
const { state: xp, earn, completeMission } = useXp()
const { scanning, scanStep, error: scanError, captureFront, captureBackAndScan, scanFrontOnly, processImages, reset: resetScan } = useCardScan()
const { pending: pendingScans, remove: removePendingScan } = usePendingScans()
const { nav, goDetail } = useNavigation()
const { error: showError } = useToast()
const eventMode = useEventMode()
const { show: openShareSheet } = useShareSheet()
const { enabled: locEnabled, detecting: locDetecting, error: locError, venues: locVenues, location: locDetected, detect: detectLocation } = useLocation()

// Tap-to-detect (never auto-prompts for permission). Fills Location with the
// city/region and surfaces nearby venues as taps for "Where We Met".
async function useMyLocation() {
  const res = await detectLocation()
  if (res?.location && !addForm.value.location) addForm.value.location = res.location
}
function pickVenue(name: string) {
  addForm.value.metAt = addForm.value.metAt === name ? '' : name
}

// In Event Mode, pre-fill "Where We Met" with the event name so the user sees
// the auto-tag (the save also enforces it regardless of the field).
onMounted(() => {
  if (eventMode.active.value && !addForm.value.metAt) addForm.value.metAt = eventMode.name.value
})

const addForm = ref<Record<string, any>>({
  firstName: '', lastName: '', title: '', company: '',
  email: '', phone: '', phones: [], website: '', industry: '', metAt: '', location: '', address: '', rating: '', notes: '', howMet: '',
  ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ''])),
})
const wasScanned = ref(false)
const showSocials = ref(false)

const addName = computed(() =>
  [addForm.value.firstName, addForm.value.lastName].filter(Boolean).join(' ')
)
const socialCount = computed(() => SOCIAL_KEYS.filter((k) => addForm.value[k]).length)

function fireConfetti() {
  confettiLib({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ['#00ff87', '#ffd700', '#ff6b35', '#4da6ff', '#b87dff'] })
}

function applyResult(result: any) {
  addForm.value = {
    firstName: result.first_name ?? '',
    lastName: result.last_name ?? '',
    title: result.title ?? '',
    company: result.company ?? '',
    email: result.email ?? '',
    phone: result.phone ?? '',
    phones: [],
    website: result.website ?? '',
    industry: result.industry ?? '',
    metAt: addForm.value.metAt,
    location: result.location ?? addForm.value.location ?? '',
    address: result.address ?? '',
    rating: '',
    notes: '',
    howMet: addForm.value.howMet,
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, result[k] ?? ''])),
  }
  wasScanned.value = true
  // Reveal the socials section if the scan pulled any handles, so they're not hidden.
  if (SOCIAL_KEYS.some((k) => addForm.value[k])) showSocials.value = true
  earn(50, '📷', 'Card scanned!', { total_scans: (xp.value.total_scans ?? 0) + 1 })
  completeMission('scan')
  useFeed().emit('card_scanned', { company: result.company || null })
  fireConfetti()
}

async function doScanFront() {
  try {
    await captureFront()
  } catch (err: any) {
    // 'Cancelled' = user backed out of the camera/picker; stay silent.
    // Anything else (photo failed to decode, etc.) used to fail silently and
    // leave the user staring at the idle screen — now we tell them.
    if (err?.message !== 'Cancelled') {
      console.error('[scan]', err)
      showError(err?.message || 'Oops — something went wrong reading that photo. Try again.')
    }
  }
}

async function doScanBack() {
  try {
    const result = await captureBackAndScan()
    applyResult(result)
  } catch (err: any) {
    if (err?.message !== 'Cancelled') {
      console.error('[scan]', err)
      showError(err?.message || 'Oops — the scan didn\'t go through. Try again.')
    }
  }
}

async function doSkipBack() {
  try {
    const result = await scanFrontOnly()
    applyResult(result)
  } catch (err: any) {
    if (err?.message !== 'Cancelled') {
      console.error('[scan]', err)
      showError(err?.message || 'Oops — the scan didn\'t go through. Try again.')
    }
  }
}

// Replay a capture stashed while offline (oldest first). The replay never
// re-stashes itself — the card is already safe in the queue until it succeeds.
async function processPendingScan() {
  const item = pendingScans.value[0]
  if (!item || scanning.value) return
  if (item.metAt && !addForm.value.metAt) addForm.value.metAt = item.metAt
  try {
    const result = await processImages(item.images, { stashOnNetworkError: false })
    removePendingScan(item.id)
    applyResult(result)
  } catch (err: any) {
    console.error('[scan] pending replay failed:', err)
    showError(err?.message || 'Couldn\'t process that card yet — it\'s still safe in the queue.')
  }
}

const saving = ref(false)

async function doSaveContact() {
  if (!addName.value || saving.value) return
  saving.value = true
  let contact: any
  try {
    contact = await createContact({
      name: addName.value,
      first_name: addForm.value.firstName || undefined,
      last_name: addForm.value.lastName || undefined,
      title: addForm.value.title || undefined,
      company: addForm.value.company || undefined,
      email: addForm.value.email || undefined,
      phone: addForm.value.phone || undefined,
      phones: cleanPhones(addForm.value.phones) ?? undefined,
      website: addForm.value.website || undefined,
      industry: addForm.value.industry || undefined,
      ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, addForm.value[k] || undefined])),
      met_at: (eventMode.active.value ? eventMode.name.value : addForm.value.metAt) || undefined,
      location: addForm.value.location || undefined,
      address: addForm.value.address || undefined,
      rating: (addForm.value.rating as any) || undefined,
      notes: addForm.value.notes || undefined,
      // Provenance: scanned card > captured during an event > typed by hand.
      source: wasScanned.value ? 'scan' : eventMode.active.value ? 'event' : 'manual',
    })
  } catch (err: any) {
    console.error('[AddContact] Failed to save contact:', err?.data?.message ?? err)
    showError(err?.data?.message || 'Couldn\'t save this contact — try again.')
    saving.value = false
    return
  }
  // Log the "how we met" starting point as the contact's first real touchpoint,
  // so it lands in the timeline rather than getting buried in static notes.
  if (addForm.value.howMet?.trim()) {
    try {
      await logActivity({
        contact: contact.id,
        type: 'meeting',
        label: 'How we met',
        date: new Date().toISOString().slice(0, 10),
        note: addForm.value.howMet.trim(),
      } as any)
    } catch (err: any) {
      console.error('[AddContact] Failed to log how-we-met touchpoint:', err?.data?.message ?? err)
    }
  }
  if (wasScanned.value) {
    try {
      await logActivity({
        contact: contact.id,
        type: 'card_scanned',
        label: 'Card Scanned',
        date: new Date().toISOString().slice(0, 10),
        note: contact.company ? `Scanned card from ${contact.company}` : null,
      } as any)
    } catch (err: any) {
      console.error('[AddContact] Failed to log card_scanned activity:', err?.data?.message ?? err)
    }
    // Notify the user's OTHER devices about the new scan. Fire-and-forget —
    // a failure here shouldn't break the save flow.
    $fetch('/api/cd/scan-notify', {
      method: 'POST',
      body: {
        contact_id: contact.id,
        contact_name: contact.name,
        contact_company: contact.company || null,
      },
    }).catch((err: any) => {
      console.warn('[AddContact] scan-notify failed:', err?.data?.message ?? err)
    })
  }
  earn(25, '💾', "They're in your network.", { total_contacts: contacts.value.length })
  addForm.value = {
    firstName: '', lastName: '', title: '', company: '',
    email: '', phone: '', phones: [], website: '', industry: '', metAt: '', location: '', address: '', rating: '', notes: '', howMet: '',
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, ''])),
  }
  wasScanned.value = false
  resetScan()
  saving.value = false
  // In Event Mode, loop straight back for the next card; otherwise open the detail.
  if (eventMode.active.value) {
    addForm.value.metAt = eventMode.name.value
    eventMode.openPanel()
  } else {
    goDetail(contact.id)
  }
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr">
      <!-- While an event is live, a back affordance returns to the Event Mode
           panel (the capture hub) so scanning loops smoothly back to the count. -->
      <button
        v-if="eventMode.active.value"
        type="button"
        class="cd-back cd-add-evt-back"
        @click="eventMode.openPanel()"
      >
        <CdIcon icon="lucide:chevron-left" :size="15" />
        <span class="cd-add-evt-live"></span>
        Back to {{ eventMode.name.value }}
      </button>
      <div class="cd-stitle">Add Contact</div>
    </div>
    <div class="cd-scrl cd-pad">
      <!-- Scan Zone: Idle state -->
      <div v-if="scanStep === 'idle' && !scanning" class="cd-scan-zone" @click="doScanFront">
        <div style="font-size: 44px; margin-bottom: 8px"><CdIcon emoji="📷" icon="lucide:camera" :size="44" /></div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 2px">
          Scan Business Card
        </div>
        <div style="font-size: 11px; font-weight: 700; color: var(--cd-accent); margin-bottom: 4px">
          <CdIcon icon="lucide:hand-pointer" :size="11" /> Tap to Scan Business Card
        </div>
        <div style="font-size: 11px; color: var(--cd-dim)">
          Earnest AI reads both sides — name, email, phone, company
        </div>
        <span class="cd-xpb" style="margin-top: 9px; display: inline-block">+50 XP</span>
      </div>

      <!-- Scan Zone: Front captured, prompt for back -->
      <div v-else-if="scanStep === 'captured-front'" class="cd-scan-captured">
        <div style="font-size: 36px; margin-bottom: 6px"><CdIcon emoji="✅" icon="lucide:check-circle" :size="36" /></div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 4px">
          Front Captured
        </div>
        <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 14px">
          Flip the card to scan the back, or skip if single-sided
        </div>
        <div style="display: flex; gap: 8px">
          <button class="cd-abtn g" style="font-size: 13px; padding: 10px" @click="doScanBack">
            <CdIcon emoji="📷" icon="lucide:camera" :size="14" /> Scan Back
          </button>
          <button class="cd-abtn b" style="font-size: 13px; padding: 10px" @click="doSkipBack">
            Skip →
          </button>
        </div>
      </div>

      <!-- Scan Zone: Processing -->
      <div v-else class="cd-scan-zone" style="pointer-events: none">
        <div class="cd-spin" style="font-size: 44px; line-height: 1"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="44" /></div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 4px">
          Reading card...
        </div>
        <div style="font-size: 11px; color: var(--cd-dim)">
          Earnest AI is extracting the details
        </div>
      </div>

      <!-- The idle-only helpers below sit OUTSIDE the scan-state v-if/v-else-if/v-else
           chain above. They must come after the chain — interleaving extra v-if
           blocks would re-bind the chain's v-else to the wrong element. -->

      <!-- Cards captured offline, waiting for a connection — one tap replays them. -->
      <button
        v-if="scanStep === 'idle' && !scanning && pendingScans.length"
        type="button"
        style="display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; margin-top: 8px; padding: 10px; background: rgba(255,215,0,0.08); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; font-size: 12px; font-weight: 700; color: var(--cd-gold, #ffd700); cursor: pointer; font-family: inherit"
        @click="processPendingScan"
      >
        <CdIcon emoji="📦" icon="lucide:inbox" :size="14" />
        {{ pendingScans.length }} card{{ pendingScans.length > 1 ? 's' : '' }} captured offline — tap to process
      </button>

      <!-- Event Mode context: show the active auto-tag, or offer to turn it on.
           Scanning at a conference is the core loop — this keeps the mode one
           tap away from where the cards actually get captured. -->
      <button
        v-if="scanStep === 'idle' && !scanning"
        type="button"
        style="display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 8px; padding: 8px; background: transparent; border: 1px dashed var(--cd-bdr); border-radius: 10px; font-size: 11px; font-weight: 700; color: var(--cd-dim); cursor: pointer; font-family: inherit"
        @click="eventMode.openPanel()"
      >
        <CdIcon icon="lucide:radio" :size="12" />
        <template v-if="eventMode.active.value">
          Tagging to <span style="color: var(--cd-accent)">{{ eventMode.name.value }}</span> · {{ eventMode.count.value }} met
        </template>
        <template v-else>
          At an event? Turn on Event Mode <CdIcon icon="lucide:arrow-right" :size="11" />
        </template>
      </button>

      <!-- Share-back row: hand out your own card / send an invite without leaving
           the capture screen. Only while an event is live (the at-an-event base). -->
      <div v-if="scanStep === 'idle' && !scanning && eventMode.active.value" class="cd-add-share">
        <button class="cd-add-share-btn" type="button" @click="openShareSheet('card')">
          <CdIcon icon="lucide:qr-code" :size="16" /> My card
        </button>
        <button class="cd-add-share-btn" type="button" @click="openShareSheet('invite')">
          <CdIcon icon="lucide:user-plus" :size="16" /> Invite
        </button>
      </div>

      <div
        v-if="scanError"
        style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 10px 13px; margin-top: 8px; margin-bottom: 10px; font-size: 12px; color: #ef4444"
      >{{ scanError }}</div>
      <div style="display: flex; align-items: center; gap: 10px; color: var(--cd-dim); font-size: 10px; margin: 12px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700">
        <div style="flex: 1; height: 1px; background: var(--cd-bdr)"></div>
        or enter manually
        <div style="flex: 1; height: 1px; background: var(--cd-bdr)"></div>
      </div>
      <div class="cd-frow">
        <div>
          <label class="cd-lbl">First Name</label>
          <input v-model="addForm.firstName" class="cd-inp" placeholder="Jane" />
        </div>
        <div>
          <label class="cd-lbl">Last Name</label>
          <input v-model="addForm.lastName" class="cd-inp" placeholder="Smith" />
        </div>
      </div>
      <div class="cd-frow">
        <div><label class="cd-lbl">Title</label><input v-model="addForm.title" class="cd-inp" placeholder="VP Product" /></div>
        <div><label class="cd-lbl">Company</label><input v-model="addForm.company" class="cd-inp" placeholder="Acme Corp" /></div>
      </div>
      <div class="cd-frow">
        <div><label class="cd-lbl">Email</label><input v-model="addForm.email" class="cd-inp" type="email" placeholder="jane@acme.com" /></div>
        <div><label class="cd-lbl">Phone <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· primary</span></label><input v-model="addForm.phone" class="cd-inp" type="tel" placeholder="+1 555 000 0000" /></div>
      </div>
      <PhonePhonesField v-model="addForm.phones" />
      <label class="cd-lbl">Website</label>
      <input v-model="addForm.website" class="cd-inp" type="url" placeholder="acme.com" />
      <!-- Location suggestions (Google Places). Hidden entirely when the feature
           is off (no API key). Tap to detect — no auto permission prompt. -->
      <div v-if="locEnabled" class="cd-loc">
        <button type="button" class="cd-loc-btn" :disabled="locDetecting" @click="useMyLocation">
          <CdIcon icon="lucide:map-pin" :size="13" :class="{ 'cd-loc-spin': locDetecting }" />
          {{ locDetecting ? 'Finding you…' : 'Use my location' }}
        </button>
        <span v-if="locDetected" class="cd-loc-found"><CdIcon icon="lucide:check" :size="11" /> {{ locDetected }}</span>
      </div>
      <div v-if="locError" class="cd-loc-err">{{ locError }}</div>

      <div class="cd-frow">
        <PhoneMetAtField v-model="addForm.metAt" />
        <div><label class="cd-lbl">Location <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· city / region</span></label><input v-model="addForm.location" class="cd-inp" placeholder="Austin, TX" /></div>
      </div>
      <!-- Nearby venues as quick fills for "Where We Met". Skipped in Event Mode
           (the event name is the tag there). -->
      <div v-if="locVenues.length && !eventMode.active.value" class="cd-loc-venues">
        <div class="cd-loc-venues-lbl">
          <CdIcon icon="lucide:map-pin" :size="11" /> Nearby places <span>· tap to set where you met</span>
        </div>
        <div class="cd-loc-chips">
          <button
            v-for="v in locVenues"
            :key="v.name"
            type="button"
            class="cd-loc-chip"
            :class="{ on: addForm.metAt === v.name }"
            @click="pickVenue(v.name)"
          ><CdIcon icon="lucide:map-pin" :size="10" /> {{ v.name }}</button>
        </div>
      </div>
      <label class="cd-lbl">Address</label>
      <textarea v-model="addForm.address" class="cd-inp" style="min-height: 48px; resize: vertical" placeholder="123 Main St, New York, NY 10001"></textarea>
      <label class="cd-lbl">Industry</label>
      <select v-model="addForm.industry" class="cd-inp" style="cursor: pointer">
        <option value="">Select...</option>
        <option v-for="ind in INDUSTRIES" :key="ind" :value="ind">{{ ind }}</option>
      </select>
      <label class="cd-lbl">Rating</label>
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px">
        <button
          v-for="r in RATINGS"
          :key="r.key"
          class="cd-rpick"
          :style="addForm.rating === r.key ? 'background:' + r.color + '22;border-color:' + r.color + ';color:' + r.color : ''"
          @click="addForm.rating = addForm.rating === r.key ? '' : r.key"
        ><CdIcon :emoji="r.emoji" :icon="r.lucide" :size="14" /> {{ r.label }}</button>
      </div>
      <label class="cd-lbl">How We Met <span style="color: var(--cd-dim); font-weight: 600; text-transform: none; letter-spacing: 0">· saved as your first touchpoint</span></label>
      <textarea v-model="addForm.howMet" class="cd-inp" style="min-height: 54px; resize: vertical" placeholder="The starting point — chatted at their booth about the rebrand, promised to send the deck"></textarea>
      <label class="cd-lbl">Notes</label>
      <textarea v-model="addForm.notes" class="cd-inp" style="min-height: 60px; resize: vertical" placeholder="Anything useful..."></textarea>

      <!-- Socials are secondary at capture time — tuck them behind a toggle so the
           core fields stay short. The dot shows when any handle is already filled. -->
      <button
        type="button"
        class="cd-collapse-toggle"
        :aria-expanded="showSocials"
        style="margin-top: 14px"
        @click="showSocials = !showSocials"
      >
        <CdIcon icon="lucide:at-sign" :size="13" />
        Social profiles
        <span v-if="socialCount" class="cd-collapse-count">{{ socialCount }}</span>
        <CdIcon :icon="showSocials ? 'lucide:chevron-up' : 'lucide:chevron-down'" :size="14" style="margin-left: auto" />
      </button>
      <template v-if="showSocials">
        <template v-for="s in SOCIALS" :key="s.key">
          <label class="cd-lbl">{{ s.label }}</label><input v-model="addForm[s.key]" class="cd-inp" :placeholder="s.placeholder" />
        </template>
      </template>
    </div>
    <div class="cd-save-bar">
      <button
        class="cd-abtn g"
        style="font-size: 16px; padding: 13px"
        :disabled="!addName || saving"
        @click="doSaveContact"
      >{{ saving ? 'Saving…' : 'SAVE + EARN 25 XP →' }}</button>
    </div>
  </div>
</template>

<style scoped>
/* Scan/add-contact form: the label and the input's placeholder were close in
   brightness, so empty fields read as just placeholder text and the label got
   lost. Fix the hierarchy here only (global .cd-lbl + .cd-inp untouched):
   make the label the bright, dominant text and push the placeholder way back. */
.cd-lbl {
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--cd-text);
  margin-bottom: 5px;
}
.cd-inp::placeholder {
  color: color-mix(in srgb, var(--cd-dim) 42%, transparent);
}

/* ── Location / venue suggestions ── */
.cd-loc { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.cd-loc-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
  color: var(--cd-accent); border-radius: 999px; padding: 6px 12px;
  font-family: inherit; font-size: 12px; font-weight: 800; cursor: pointer; transition: background 0.15s;
}
.cd-loc-btn:hover { background: color-mix(in srgb, var(--cd-accent) 20%, transparent); }
.cd-loc-btn:disabled { opacity: 0.6; cursor: default; }
.cd-loc-spin { animation: cd-loc-spin 0.9s linear infinite; }
@keyframes cd-loc-spin { to { transform: rotate(360deg); } }
.cd-loc-found { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: var(--cd-muted); }
.cd-loc-found :deep(svg) { color: var(--cd-accent); }
.cd-loc-err { font-size: 11.5px; color: #f87171; margin-bottom: 8px; }
.cd-loc-venues { margin: 8px 0 10px; }
.cd-loc-venues-lbl {
  display: flex; align-items: center; gap: 5px; margin-bottom: 6px;
  font-size: 11px; font-weight: 800; color: var(--cd-muted); text-transform: uppercase; letter-spacing: 0.04em;
}
.cd-loc-venues-lbl :deep(svg) { color: var(--cd-accent); }
.cd-loc-venues-lbl span { font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--cd-dim); }
.cd-loc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.cd-loc-chip {
  display: inline-flex; align-items: center; gap: 4px; max-width: 100%;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text);
  border-radius: 999px; padding: 5px 11px; font-family: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.cd-loc-chip :deep(svg) { flex-shrink: 0; color: var(--cd-dim); }
.cd-loc-chip:hover { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.cd-loc-chip.on {
  border-color: var(--cd-accent); color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
}
.cd-loc-chip.on :deep(svg) { color: var(--cd-accent); }

/* ── Event-mode "back to event" header link + share-back row ── */
.cd-add-evt-back { color: var(--cd-accent); }
.cd-add-evt-live {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  background: var(--cd-accent);
  box-shadow: 0 0 7px color-mix(in srgb, var(--cd-accent) 70%, transparent);
  animation: cd-add-pulse 1.6s ease-in-out infinite;
}
@keyframes cd-add-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
.cd-add-share { display: flex; gap: 8px; margin-top: 8px; }
.cd-add-share-btn {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 10px; border-radius: 12px; cursor: pointer;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text);
  font-family: inherit; font-size: 13px; font-weight: 700;
  transition: border-color 0.15s, background 0.15s, transform 0.12s;
}
.cd-add-share-btn :deep(svg) { color: var(--cd-accent); flex-shrink: 0; }
.cd-add-share-btn:hover { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.cd-add-share-btn:active { transform: scale(0.98); }
</style>
