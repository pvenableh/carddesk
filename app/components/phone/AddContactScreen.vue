<script setup lang="ts">
import { RATINGS, INDUSTRIES } from '~/composables/useConstants'
import { SOCIALS, SOCIAL_KEYS } from '~/types/socials'
import { cleanPhones } from '~/types/contact'
import type { CardLinkFailReason } from '~/types/card-link'
import { CardLinkError } from '~/composables/useCardLink'
import confettiLib from 'canvas-confetti'

const { contacts, createContact, logActivity } = useContacts()
const { state: xp, earn, completeMission } = useXp()
const { scanning, scanStep, error: scanError, captureFront, captureBack, scanBothSides, scanFrontOnly, processImages, reset: resetScan } = useCardScan()
const { resolve: resolveCardLink, selfContainedCard, linkTarget, resolving: resolvingLink } = useCardLink()
const { pending: pendingScans, remove: removePendingScan } = usePendingScans()
const { nav, goDetail } = useNavigation()
const { error: showError, info: showInfo } = useToast()
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

/**
 * Fill the form from a captured card. `source` only changes the celebration
 * copy — a code and a photo are both "a card you scanned" as far as XP, the
 * scan mission, and contact provenance are concerned.
 *
 * `merge` fills the gaps instead of replacing the form: it's how a QR read
 * *after* a photo scan tops up what the photo missed without throwing away
 * what it got. The new values still win wherever both have something — the
 * user asked for the code precisely because it's the more exact source.
 */
function applyResult(result: any, source: 'photo' | 'code' = 'photo', opts: { merge?: boolean } = {}) {
  const prev = addForm.value
  /** New value, falling back to what's already typed/scanned when merging. */
  const pick = (next: any, key: string) => (next ?? '') || (opts.merge ? (prev[key] ?? '') : '')
  // Some sources (a page read by AI, a sparse vCard) give a full name but no
  // split parts — without this the name is dropped on the floor.
  let first = result.first_name ?? ''
  let last = result.last_name ?? ''
  if (!first && !last && result.name) {
    const parts = String(result.name).trim().split(/\s+/)
    first = parts.shift() ?? ''
    last = parts.join(' ')
  }
  addForm.value = {
    firstName: pick(first, 'firstName'),
    lastName: pick(last, 'lastName'),
    title: pick(result.title, 'title'),
    company: pick(result.company, 'company'),
    email: pick(result.email, 'email'),
    phone: pick(result.phone, 'phone'),
    // A vCard from a QR can carry several numbers; the AI photo scan never does.
    phones: Array.isArray(result.phones) && result.phones.length
      ? result.phones
      : (opts.merge ? prev.phones : []),
    // Keep a URL the user chose to hang on to (the QR turned out to be their
    // website) unless this scan found a better one.
    website: result.website ?? prev.website ?? '',
    industry: pick(result.industry, 'industry'),
    metAt: prev.metAt,
    location: result.location ?? prev.location ?? '',
    address: pick(result.address, 'address'),
    rating: opts.merge ? prev.rating : '',
    notes: opts.merge ? prev.notes : '',
    howMet: prev.howMet,
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, pick(result[k], k)])),
  }
  wasScanned.value = true
  // Reveal the socials section if the scan pulled any handles, so they're not hidden.
  if (SOCIAL_KEYS.some((k) => addForm.value[k])) showSocials.value = true
  // Only celebrate a scan that actually came back with a person. A QR that led
  // to a thin page, or a photo the AI couldn't read, leaves the form empty —
  // confetti and +50 XP over nothing reads as a bug and inflates the streak.
  const gotSomeone = Boolean(
    addForm.value.firstName || addForm.value.lastName || addForm.value.email || addForm.value.phone,
  )
  if (!gotSomeone) {
    showInfo(
      addForm.value.company || addForm.value.website
        ? "Only the company came back from that — add their name and details to save it."
        : "That didn't come back with any details — try a clearer photo, or type them in.",
    )
    return
  }
  // Reading the code after the photo (or the other way round) is still one
  // card: top up the form, but don't hand out the scan reward twice.
  if (earnedForCard.value) {
    showInfo(source === 'code' ? 'Filled in from their QR code.' : 'Updated from that scan.')
    return
  }
  earnedForCard.value = true
  earn(
    50,
    source === 'code' ? '🔗' : '📷',
    source === 'code' ? 'Card code read!' : 'Card scanned!',
    { total_scans: (xp.value.total_scans ?? 0) + 1 },
  )
  completeMission('scan')
  useFeed().emit('card_scanned', { company: result.company || null })
  fireConfetti()
}

// A QR code found on the card that's just a link. We ask before following it: a
// code printed on a paper business card is as likely to be the company website
// as it is to be the person's card, and only the user knows which they were
// pointing the camera at. It's kept for the whole capture rather than consumed
// by one decision — photographing the back doesn't throw the code away, and the
// offer comes back afterwards if the scan didn't get everything.
const qrLink = ref<string | null>(null)
/** Set once the code has had its turn — resolved into the form, or tried and
 *  found wanting. Either way the offer stops following the user around. */
const qrSettled = ref(false)
/** XP is per card, not per attempt: a photo scan followed by "fetch from the
 *  QR" is one card captured, so the 50 lands once. */
const earnedForCard = ref(false)

function clearQrState() {
  qrLink.value = null
  qrMiss.value = null
  qrSettled.value = false
  earnedForCard.value = false
}

/**
 * A code we followed that didn't end in a contact. Kept as state rather than a
 * toast because the way out differs per reason: a company website is worth
 * keeping as a website, a dead link is worth retrying, and either way the
 * printed card is still sitting there waiting to be read.
 */
interface QrMiss {
  reason: CardLinkFailReason
  message: string
  /** The original code, so "Try again" can re-run it. */
  payload: string
  /** Where it actually pointed (after redirects), when we got that far. */
  url: string | null
  /** Short label for the page — a company or site name. */
  siteName: string | null
}
const qrMiss = ref<QrMiss | null>(null)

/** Headline + hint + which ways out to offer, per reason. */
const qrMissCopy = computed(() => {
  const miss = qrMiss.value
  if (!miss) return null
  const site = miss.siteName || (miss.url ? miss.url.replace(/^https?:\/\//, '').split('/')[0] : 'that page')
  switch (miss.reason) {
    case 'website':
      return {
        title: 'A Website, Not A Card',
        hint: `That QR opens ${site} — a website, with no contact card on it to pull details from.`,
        icon: 'lucide:globe',
        emoji: '🌐',
        retry: false,
        keepWebsite: true,
      }
    case 'not-a-card':
      return {
        title: 'Not A Contact Code',
        hint: "That QR isn't a card or a link — it's something else entirely (a wifi code, a product tag).",
        icon: 'lucide:scan-line',
        emoji: '🤷',
        retry: false,
        keepWebsite: false,
      }
    case 'unreachable':
    case 'offline':
      return {
        title: miss.reason === 'offline' ? 'No Connection' : 'That Link Went Nowhere',
        hint: miss.message,
        icon: 'lucide:unplug',
        emoji: '🔌',
        retry: true,
        keepWebsite: false,
      }
    default:
      // 'no-details' (a card-ish page we got nothing off) and 'missing-card'
      // (a deleted CardDesk card). Retrying re-reads the same page for the same
      // result — and costs a credit — so it isn't offered.
      return {
        title: 'Nothing To Import',
        hint: miss.message,
        icon: 'lucide:file-question',
        emoji: '📄',
        retry: false,
        keepWebsite: miss.reason === 'no-details' && Boolean(miss.url),
      }
  }
})

/** Resolve a scanned code into the form (free for codes that carry the whole
 *  card; a hosted card link may cost a credit — see resolve-card-link). */
async function useScannedCode(payload: string, opts: { merge?: boolean } = {}) {
  try {
    const { contacts } = await resolveCardLink(payload)
    qrMiss.value = null
    qrSettled.value = true
    applyResult(contacts[0], 'code', opts)
    resetScan()
  } catch (err: any) {
    console.error('[scan] code', err)
    // No red toast: the panel below says what the code turned out to be and
    // offers the way on, and the captured photo is still ready to OCR. The code
    // is settled either way — re-offering one we've just shown to be a website
    // would send the user round the same loop.
    qrSettled.value = true
    qrMiss.value = {
      reason: err instanceof CardLinkError ? err.reason : 'no-details',
      message: err?.message || "We couldn't read that code.",
      payload,
      url: (err instanceof CardLinkError ? err.url : null) ?? linkTarget(payload),
      siteName: err instanceof CardLinkError ? err.siteName : null,
    }
  }
}

/** Take a code that carries the whole card (vCard / MECARD / tel:). Nothing to
 *  fetch and nothing to charge, so it's applied without asking. */
function takeLocalCard(card: any) {
  qrSettled.value = true
  qrMiss.value = null
  applyResult(card, 'code', { merge: wasScanned.value })
  resetScan()
}

/** Dismiss the "that code went nowhere" panel and carry on with the photos. */
function ignoreQrLink() {
  qrMiss.value = null
}

/** Re-run a code that failed on something transient (dead wifi, a slow host). */
function retryQrLink() {
  const payload = qrMiss.value?.payload
  if (!payload) return
  qrMiss.value = null
  useScannedCode(payload, { merge: wasScanned.value })
}

/** The code was a website — not nothing. Keep it on the contact and carry on
 *  reading the printed card for the details it didn't have. */
function keepQrAsWebsite() {
  const url = qrMiss.value?.url || qrMiss.value?.payload
  if (url) {
    addForm.value.website = url
    showInfo('Kept as their website — scan the card for the rest.')
  }
  qrMiss.value = null
}

// ── Capture mode ──
// Two different things arrive at this screen: a piece of card stock (photograph
// it, let the AI read it, 5 credits) and a code on someone's phone (scan it
// live, exact, free). They want different cameras and different copy, so the
// user picks rather than us guessing from a photo after the fact.
type CaptureMode = 'card' | 'code'
const captureMode = ref<CaptureMode>('card')
const scannerOpen = ref(false)

function openScanner() {
  clearQrState()
  scannerOpen.value = true
}

/**
 * A code read live. The user explicitly asked for a code here, so a link is
 * followed straight away rather than offered — there's no photo behind it to
 * fall back to, and the miss panel covers it if the link leads nowhere.
 */
function onCodeScanned(payload: string) {
  scannerOpen.value = false
  const card = selfContainedCard(payload)
  if (card) { takeLocalCard(card); return }
  if (linkTarget(payload)) {
    qrLink.value = payload
    useScannedCode(payload)
    return
  }
  qrMiss.value = { reason: 'not-a-card', message: '', payload, url: null, siteName: null }
}

/** The scanner couldn't run (or the user would rather shoot a still). Photos
 *  decode codes too — `captureFront` looks for one before spending the scan. */
function scannerFallbackToPhoto() {
  scannerOpen.value = false
  // Here the code IS the capture, so the decode gets every pass it has.
  doScanFront({ thorough: true })
}

async function doScanFront(opts: { thorough?: boolean } = {}) {
  try {
    clearQrState()
    const qr = await captureFront(opts)
    // A code carrying the whole card (vCard / MECARD / tel:) is unambiguous and
    // costs nothing — take it. A link is offered, not assumed. Anything else
    // isn't a card at all, and says so rather than posing as a link.
    if (qr) {
      const card = selfContainedCard(qr)
      if (card) takeLocalCard(card)
      else if (linkTarget(qr)) qrLink.value = qr
      else qrMiss.value = { reason: 'not-a-card', message: '', payload: qr, url: null, siteName: null }
    }
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
    // Plenty of cards put the QR on the back. Read it before spending the scan:
    // a code carrying the whole card is exact and free, so it wins outright.
    const qr = await captureBack()
    if (qr) {
      const card = selfContainedCard(qr)
      if (card) { takeLocalCard(card); return }
      // A link on the back is offered the same way a link on the front is —
      // after the scan, once we know what the photos actually got.
      if (!qrLink.value && linkTarget(qr)) qrLink.value = qr
    }
    const result = await scanBothSides()
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
  clearQrState()
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
    <PhoneQrScanner
      :open="scannerOpen"
      @found="onCodeScanned"
      @close="scannerOpen = false"
      @fallback="scannerFallbackToPhoto"
    />
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
      <!-- Scan Zone: reading a code we found (or chasing where it points) -->
      <div v-if="resolvingLink || scanStep === 'reading-code'" class="cd-scan-zone" style="pointer-events: none">
        <div class="cd-spin" style="font-size: 44px; line-height: 1"><CdIcon emoji="🔍" icon="lucide:loader-circle" :size="44" /></div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 4px">
          {{ resolvingLink ? 'Reading their card…' : 'Checking for a code…' }}
        </div>
        <div style="font-size: 11px; color: var(--cd-dim)">
          {{ resolvingLink ? 'Following the code to their contact details' : 'QR codes carry the details exactly' }}
        </div>
      </div>

      <!-- Scan Zone: the code led somewhere, just not to a card. Says which —
           a website, a dead link, a wifi QR — and hands back a way on. No XP,
           no confetti: nothing was captured. -->
      <div v-else-if="qrMiss && qrMissCopy" class="cd-scan-captured cd-qr-miss">
        <div style="font-size: 36px; margin-bottom: 6px">
          <CdIcon :emoji="qrMissCopy.emoji" :icon="qrMissCopy.icon" :size="36" />
        </div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; color: var(--cd-gold, #ffd700); margin-bottom: 4px">
          {{ qrMissCopy.title }}
        </div>
        <div v-if="qrMiss.url" class="cd-qr-link" :title="qrMiss.url">{{ qrMiss.url }}</div>
        <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">
          {{ qrMissCopy.hint }}
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center">
          <button v-if="qrMissCopy.keepWebsite" class="cd-abtn g" style="font-size: 13px; padding: 10px" @click="keepQrAsWebsite">
            <CdIcon emoji="🌐" icon="lucide:globe" :size="14" /> Save as website
          </button>
          <button v-if="qrMissCopy.retry" class="cd-abtn g" style="font-size: 13px; padding: 10px" :disabled="resolvingLink" @click="retryQrLink">
            <CdIcon emoji="🔄" icon="lucide:rotate-ccw" :size="14" /> Try again
          </button>
          <!-- With a photo already taken, this just steps back to it; scanning a
               code from the idle screen has nothing behind it, so it offers the
               photo path instead of dead-ending. -->
          <button
            class="cd-abtn b"
            style="font-size: 13px; padding: 10px"
            @click="scanStep === 'captured-front' ? ignoreQrLink() : scannerFallbackToPhoto()"
          >
            {{ scanStep === 'captured-front' ? 'Scan the card →' : 'Photograph the card' }}
          </button>
        </div>
      </div>

      <!-- Scan Zone: idle. The mode switch comes first because the two inputs
           are genuinely different jobs — a printed card is photographed and read
           by AI, a code is scanned live and costs nothing. -->
      <template v-else-if="scanStep === 'idle' && !scanning">
        <div class="cd-mode" role="tablist">
          <button
            type="button"
            role="tab"
            class="cd-mode-btn"
            :class="{ on: captureMode === 'card' }"
            :aria-selected="captureMode === 'card'"
            @click="captureMode = 'card'"
          >
            <CdIcon emoji="💳" icon="lucide:credit-card" :size="14" /> Business card
          </button>
          <button
            type="button"
            role="tab"
            class="cd-mode-btn"
            :class="{ on: captureMode === 'code' }"
            :aria-selected="captureMode === 'code'"
            @click="captureMode = 'code'"
          >
            <CdIcon emoji="🔗" icon="lucide:qr-code" :size="14" /> QR code
          </button>
        </div>

        <div v-if="captureMode === 'card'" class="cd-scan-zone" @click="doScanFront()">
          <div style="font-size: 44px; margin-bottom: 8px"><CdIcon emoji="📷" icon="lucide:camera" :size="44" /></div>
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 2px">
            Scan Business Card
          </div>
          <div style="font-size: 11px; font-weight: 700; color: var(--cd-accent); margin-bottom: 4px">
            <CdIcon icon="lucide:hand-pointer" :size="11" /> Tap to Scan Business Card
          </div>
          <!-- Both hint lines are sized to stay on ONE line down to a 320px
               viewport (~252px of inner width at 11px). Lengthening either one
               past ~240px wraps them on a phone. -->
          <div style="font-size: 11px; color: var(--cd-dim)">
            Earnest AI reads both sides of the card
          </div>
          <div style="font-size: 11px; color: var(--cd-dim); margin-top: 2px">
            A QR on the card gets read too — either side
          </div>
          <span class="cd-xpb" style="margin-top: 9px; display: inline-block">+50 XP</span>
        </div>

        <div v-else class="cd-scan-zone" @click="openScanner">
          <div style="font-size: 44px; margin-bottom: 8px"><CdIcon emoji="🔗" icon="lucide:qr-code" :size="44" /></div>
          <div style="font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 2px">
            Scan A QR Code
          </div>
          <div style="font-size: 11px; font-weight: 700; color: var(--cd-accent); margin-bottom: 4px">
            <CdIcon icon="lucide:hand-pointer" :size="11" /> Tap to open the scanner
          </div>
          <div style="font-size: 11px; color: var(--cd-dim)">
            Point at their code — no photo to take
          </div>
          <div style="font-size: 11px; color: var(--cd-dim); margin-top: 2px">
            Their digital card, or the code on a printed one
          </div>
          <span class="cd-xpb" style="margin-top: 9px; display: inline-block">+50 XP</span>
        </div>
      </template>

      <!-- Scan Zone: front captured — with the card's QR offered alongside the
           photos rather than instead of them. A code printed on a business card
           is as often the company website as the person's card, so following it
           stays a choice; picking the camera doesn't throw the code away. -->
      <div v-else-if="scanStep === 'captured-front'" class="cd-scan-captured">
        <div style="font-size: 36px; margin-bottom: 6px">
          <CdIcon :emoji="qrLink && !qrSettled ? '🔗' : '✅'" :icon="qrLink && !qrSettled ? 'lucide:qr-code' : 'lucide:check-circle'" :size="36" />
        </div>
        <div style="font-family: 'Bebas Neue', sans-serif; font-size: 18px; letter-spacing: 1px; color: var(--cd-accent); margin-bottom: 4px">
          {{ qrLink && !qrSettled ? 'QR Code On This Card' : 'Front Captured' }}
        </div>
        <template v-if="qrLink && !qrSettled">
          <div class="cd-qr-link" :title="qrLink">{{ qrLink }}</div>
          <div style="font-size: 11px; color: var(--cd-muted); margin-bottom: 12px">
            Fetch their details from the code, or carry on photographing the card.
          </div>
          <button class="cd-abtn g" style="font-size: 13px; padding: 10px; width: 100%; margin-bottom: 8px" @click="useScannedCode(qrLink)">
            <CdIcon emoji="🔗" icon="lucide:link" :size="14" /> Use the code
          </button>
        </template>
        <div v-else style="font-size: 11px; color: var(--cd-muted); margin-bottom: 14px">
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

      <!-- The card had a QR we didn't follow, and the photos are done (or the
           scan failed). Offer it once more: it fills the gaps the scan left
           rather than replacing what it got, and it's the exact data where the
           OCR was only ever a best reading. -->
      <button
        v-if="scanStep === 'idle' && !scanning && qrLink && !qrSettled"
        type="button"
        class="cd-qr-offer"
        @click="useScannedCode(qrLink, { merge: true })"
      >
        <CdIcon emoji="🔗" icon="lucide:qr-code" :size="15" />
        <span>This card had a QR code — fill in the rest from it</span>
        <CdIcon icon="lucide:arrow-right" :size="15" />
      </button>

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

      <!-- Import a shared card: the inbound path for cards people AirDrop / send
           you (a .vcf). Sits right under the scan zone as a peer capture method. -->
      <button
        v-if="scanStep === 'idle' && !scanning"
        type="button"
        class="cd-add-import"
        @click="nav('import')"
      >
        <CdIcon icon="lucide:contact" :size="15" />
        <span>Import a card someone sent you</span>
        <CdIcon icon="lucide:arrow-right" :size="15" />
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
/* The scanned URL, shown so the user can see where the code actually points
   before we open it — a QR is unreadable by eye, so this is the only chance
   they get to notice it's not the card they expected. */
.cd-mode {
  display: flex;
  gap: 6px;
  padding: 4px;
  margin-bottom: 10px;
  border: 1px solid var(--cd-bdr);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
}
.cd-mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--cd-dim);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}
.cd-mode-btn.on {
  background: rgba(0, 255, 135, 0.1);
  color: var(--cd-accent);
  box-shadow: inset 0 0 0 1px rgba(0, 255, 135, 0.28);
}
@media (prefers-reduced-motion: reduce) {
  .cd-mode-btn { transition: none; }
}
.cd-qr-offer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  margin-top: 8px;
  padding: 10px;
  background: rgba(0, 255, 135, 0.07);
  border: 1px solid rgba(0, 255, 135, 0.28);
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--cd-accent);
  cursor: pointer;
  font-family: inherit;
}
.cd-qr-miss {
  /* Reads as "note", not "success" — same panel, warmer border than a capture. */
  border-color: rgba(255, 215, 0, 0.28);
}
.cd-qr-link {
  max-width: 100%; margin: 0 auto 8px; padding: 5px 9px; border-radius: 8px;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
  font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--cd-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  direction: ltr;
}

/* ── Import-a-shared-card link (peer to the scan zone) ──
   Full-bleed like the scan zone and the Event Mode row it sits between, but the
   content is a centred group — icon, label, arrow, all one gap apart and both
   icons the same size. Letting the label grow (flex:1) pinned the arrow to the
   far edge, which read as a stretched bar the moment the column got wide. */
.cd-add-import {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; margin-top: 8px;
  padding: 12px 14px; border-radius: 12px; cursor: pointer;
  background: color-mix(in srgb, var(--cd-accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 26%, transparent);
  color: var(--cd-text); font-family: inherit; font-size: 13px; font-weight: 700;
  transition: border-color 0.15s, background 0.15s;
}
.cd-add-import :deep(svg) { color: var(--cd-accent); flex-shrink: 0; }
.cd-add-import:hover { border-color: color-mix(in srgb, var(--cd-accent) 45%, transparent); }

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
