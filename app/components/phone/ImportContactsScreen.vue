<script setup lang="ts">
/**
 * Import Contacts — the inbound capture surface for cards people hand you at an
 * event. AirDrop, a digital/QR scan, or a shared message all drop a `.vcf`
 * (vCard) onto your phone; here you pick those files, preview who's in them, and
 * save the ones you want — auto-tagged to the live event, just like a scan.
 *
 * We can't silently listen to AirDrop (no web API for it), so this is the
 * reliable path: receive the card, then import it. On platforms that support the
 * Web Share Target, cards can also arrive pre-parsed via `usePendingImport`.
 */
import type { ShareableContact } from '~/types/vcard'
import { SOCIAL_KEYS } from '~/types/socials'
import confettiLib from 'canvas-confetti'

const { pickFiles } = useVCardImport()
const { supported: canPickPhone, pick: pickPhoneContacts } = useContactPicker()
const { take: takePendingImport, cards: pendingImportCards } = usePendingImport()
const { contacts, createContact } = useContacts()
const { nav } = useNavigation()
const { error: showError } = useToast()
const { state: xp, earn } = useXp()
const { show: openShareSheet } = useShareSheet()
const eventMode = useEventMode()

interface Row {
  /** Stable id so the list keeps its identity across filter/sort reorders. */
  key: string
  /** Monotonic add-order — higher = added more recently (drives "Recent" sort). */
  seq: number
  contact: ShareableContact
  selected: boolean
  /** An existing contact this card looks like a duplicate of, if any. */
  dupe: import('~/types/directus').CdContact | null
}

let rowSeq = 0
const rows = ref<Row[]>([])
const reading = ref(false)

const digits = (s?: string | null) => (s || '').replace(/\D/g, '')

// Match an incoming card against the network by email or phone — the two
// reliable identity keys. Name-only matches are too collision-prone to trust.
function findDupe(c: ShareableContact): import('~/types/directus').CdContact | null {
  const email = (c.email || '').trim().toLowerCase()
  const phone = digits(c.phone)
  return (
    contacts.value.find((x) => {
      if (email && (x.email || '').trim().toLowerCase() === email) return true
      if (phone && phone.length >= 7 && digits(x.phone) === phone) return true
      return false
    }) || null
  )
}

function toRows(parsed: ShareableContact[]): Row[] {
  return parsed.map((c) => {
    const dupe = findDupe(c)
    // Pre-check everything that's new; leave likely dupes off by default so a
    // re-import doesn't quietly clone half the user's network.
    const seq = rowSeq++
    return { key: `r${seq}`, seq, contact: c, selected: !dupe, dupe }
  })
}

// Append (don't replace) parsed contacts, skipping ones already in the list so
// a second file / a re-pick doesn't duplicate rows. Returns how many were added.
function addParsed(parsed: ShareableContact[]): number {
  const existing = new Set(rows.value.map((r) => JSON.stringify(r.contact)))
  const fresh = toRows(parsed).filter((r) => !existing.has(JSON.stringify(r.contact)))
  rows.value = [...rows.value, ...fresh]
  return fresh.length
}

async function choose() {
  if (reading.value) return
  reading.value = true
  try {
    const parsed = await pickFiles()
    if (!parsed.length) return // cancelled, or nothing parseable — stay put
    if (!addParsed(parsed)) showError("Those cards are already in this list.")
  } catch (err: any) {
    console.error('[import]', err)
    showError("Couldn't read those files — make sure they're .vcf contact cards.")
  } finally {
    reading.value = false
  }
}

// One-tap intake from the phone's own address book (Android Chrome) — where the
// AirDrops / QR shares people did outside CardDesk already landed.
async function pickFromPhone() {
  if (reading.value) return
  reading.value = true
  try {
    const parsed = await pickPhoneContacts()
    if (!parsed.length) return // cancelled
    if (!addParsed(parsed)) showError("Those contacts are already in this list.")
  } catch (err: any) {
    console.error('[import] phone picker', err)
    showError("Couldn't open your contacts — try the file option instead.")
  } finally {
    reading.value = false
  }
}

// iPhone AirDrops save into the native Contacts app (which no web app can read
// directly), so iOS gets a tailored "export from Contacts" recipe instead of the
// one-tap picker. Detect it client-side; iPadOS reports as MacIntel + touch.
const isIOS = ref(false)

// Cards handed off by the Web Share Target land in the pending slot — pull them
// in on mount so a shared card opens straight into the preview.
onMounted(() => {
  isIOS.value =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  if (pendingImportCards.value.length) rows.value = toRows(takePendingImport())
})

// ── Search + sort over the preview list ──
// Note on "Recent": vCards / the OS contact picker carry no reliable "date
// added", so we can't sort by the phone's real recency. "Recent" here means the
// order you brought cards into THIS import (newest first) — so a card you just
// added floats to the top.
const query = ref('')
type SortMode = 'recent' | 'az'
const sortMode = ref<SortMode>('recent')

// Show the tools only once the list is big enough to warrant them.
const showTools = computed(() => rows.value.length > 5)

const visibleRows = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = rows.value
  if (q) {
    list = list.filter((r) => {
      const c = r.contact
      return [c.name, c.title, c.company, c.email, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }
  // Copy before sorting so we never mutate the source order (that order is what
  // "Recent" reads from).
  const out = [...list]
  if (sortMode.value === 'az') out.sort((a, b) => (a.contact.name || '').localeCompare(b.contact.name || ''))
  else out.sort((a, b) => b.seq - a.seq) // newest-added first
  return out
})

const selectedCount = computed(() => rows.value.filter((r) => r.selected).length)
// "Select all" acts on what's currently visible (respects an active search).
const allSelected = computed(() => visibleRows.value.length > 0 && visibleRows.value.every((r) => r.selected))
function toggleAll() {
  const next = !allSelected.value
  visibleRows.value.forEach((r) => (r.selected = next))
}
function sub(c: ShareableContact): string {
  return [c.title, c.company].filter(Boolean).join(' · ')
}
function contactLine(c: ShareableContact): string {
  return c.email || c.phone || ''
}
function initials(n: string): string {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
}

const importing = ref(false)
const done = ref(false)
const savedCount = ref(0)

async function doImport() {
  if (importing.value) return
  const picked = rows.value.filter((r) => r.selected)
  if (!picked.length) return
  importing.value = true
  let saved = 0
  const metAt = eventMode.active.value ? eventMode.name.value : undefined
  for (const r of picked) {
    const c = r.contact
    try {
      await createContact({
        name: c.name || 'Unnamed contact',
        first_name: c.first_name || undefined,
        last_name: c.last_name || undefined,
        title: c.title || undefined,
        company: c.company || undefined,
        email: c.email || undefined,
        phone: c.phone || undefined,
        phones: (Array.isArray(c.phones) && c.phones.length ? c.phones : undefined) as any,
        website: c.website || undefined,
        ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, c[k] || undefined])),
        notes: c.notes || undefined,
        met_at: metAt,
        // Provenance: these came in as a shared card (AirDrop / .vcf), not a
        // manual type-in or a camera scan.
        source: 'import',
      } as any)
      saved++
    } catch (err: any) {
      console.error('[import] Failed to save', c.name, err?.data?.message ?? err)
    }
  }
  importing.value = false
  savedCount.value = saved
  if (!saved) {
    showError("Couldn't import those contacts — try again.")
    return
  }
  earn(Math.min(150, 15 * saved), '📥', `${saved} contact${saved === 1 ? '' : 's'} imported!`, {
    total_contacts: contacts.value.length,
  })
  confettiLib({ particleCount: 70, spread: 72, origin: { y: 0.6 }, colors: ['#00ff87', '#ffd700', '#ff6b35', '#4da6ff', '#b87dff'] })
  done.value = true
}

function finish() {
  const wasEvent = eventMode.active.value
  rows.value = []
  done.value = false
  savedCount.value = 0
  if (wasEvent) eventMode.openPanel()
  else nav('contacts')
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr">
      <button
        v-if="eventMode.active.value"
        type="button"
        class="cd-back cd-imp-evt-back"
        @click="eventMode.openPanel()"
      >
        <CdIcon icon="lucide:chevron-left" :size="15" />
        <span class="cd-imp-evt-live"></span>
        Back to {{ eventMode.name.value }}
      </button>
      <button v-else type="button" class="cd-back" @click="nav('add')">
        <CdIcon icon="lucide:chevron-left" :size="15" /> Add
      </button>
      <div class="cd-stitle">Import Contacts</div>
    </div>

    <div class="cd-scrl cd-pad">
      <!-- ── Done summary ── -->
      <template v-if="done">
        <div class="imp-summary glass-surface">
          <div class="imp-summary-ico"><CdIcon icon="lucide:party-popper" :size="52" /></div>
          <div class="imp-summary-count">{{ savedCount }}</div>
          <div class="imp-summary-title">{{ savedCount === 1 ? 'contact imported' : 'contacts imported' }}</div>
          <p class="imp-summary-sub">
            <template v-if="eventMode.active.value">Tagged to <b>{{ eventMode.name.value }}</b> and waiting in your network.</template>
            <template v-else>They're in your network — sort them into your pipeline whenever you're ready.</template>
          </p>
          <!-- Symmetric exchange: they handed you their card, so offer yours back
               before finishing — same global ShareSheet the scan loop uses. -->
          <p class="imp-swap-hint"><CdIcon icon="lucide:repeat" :size="12" /> Make it a swap — send your card back so they've got you too.</p>
          <button class="cd-abtn g imp-cta" @click="openShareSheet('card')">
            <CdIcon icon="lucide:qr-code" :size="15" /> Share my card back
          </button>
          <button class="cd-abtn b imp-cta imp-cta-done" @click="finish">
            <CdIcon icon="lucide:check" :size="14" /> Done
          </button>
        </div>
      </template>

      <!-- ── Empty state: choose an intake ── -->
      <template v-else-if="!rows.length">
        <!-- Primary where supported (Android Chrome): pull straight from the
             phone's address book — where AirDrops/QR shares already landed. -->
        <div v-if="canPickPhone" class="imp-hero glass-surface" :class="{ busy: reading }" @click="pickFromPhone">
          <div class="imp-hero-ico"><CdIcon icon="lucide:book-user" :size="40" /></div>
          <div class="imp-hero-title">Pull from your phone</div>
          <p class="imp-hero-sub">
            Everyone who AirDropped or shared their info is already in your phone's contacts.
            Pick them straight from there — no files.
          </p>
          <span class="cd-abtn g imp-hero-btn">
            <CdIcon icon="lucide:contact" :size="15" /> {{ reading ? 'Opening…' : 'Pick from phone contacts' }}
          </span>
        </div>

        <!-- File-based intake — primary on iOS (no picker there), secondary
             elsewhere as the fallback for a shared .vcf. -->
        <div
          class="imp-hero glass-surface"
          :class="{ busy: reading, 'imp-hero-sec': canPickPhone }"
          @click="choose"
        >
          <div class="imp-hero-ico"><CdIcon icon="lucide:contact" :size="canPickPhone ? 30 : 40" /></div>
          <div class="imp-hero-title">Import shared cards</div>
          <p class="imp-hero-sub">
            Got someone's contact card as a <b>.vcf</b> — by AirDrop, a QR/digital scan, or a message?
            Choose the file{{ '' }}s here and we'll pull everyone in.
          </p>
          <span class="cd-abtn g imp-hero-btn">
            <CdIcon icon="lucide:folder-open" :size="15" /> {{ reading ? 'Reading…' : 'Choose contact files' }}
          </span>
        </div>

        <div v-if="eventMode.active.value" class="imp-evt-note">
          <CdIcon icon="lucide:radio" :size="12" />
          Imported cards get tagged to <span>{{ eventMode.name.value }}</span>
        </div>

        <!-- Guidance. iOS AirDrops land in the native Contacts app (unreadable by
             any web app), so iPhone users get the export recipe; everyone else
             gets the quick how-it-works. -->
        <div class="imp-guide">
          <div class="imp-guide-lbl">
            <CdIcon :icon="isIOS ? 'lucide:smartphone' : 'lucide:info'" :size="12" />
            <template v-if="isIOS">Got their AirDrop in your iPhone Contacts?</template>
            <template v-else>How it works</template>
          </div>
          <ol class="imp-steps">
            <template v-if="isIOS">
              <li>Open <b>Contacts</b> and tap the person who shared with you.</li>
              <li>Scroll down → <b>Share Contact</b> → <b>Save to Files</b> (that's a <b>.vcf</b>).</li>
              <li>Come back and tap <b>Choose contact files</b> above — grab several at once and they all import together.</li>
            </template>
            <template v-else>
              <li><b>Pick from phone contacts</b> above, or choose a <b>.vcf</b> someone shared.</li>
              <li>Review who to add — duplicates are flagged and left unchecked.</li>
              <li>Import — they're tagged to your event and ready to work.</li>
            </template>
          </ol>
        </div>
      </template>

      <!-- ── Preview + select ── -->
      <template v-else>
        <!-- Search + sort — only when the list is long enough to need them. -->
        <template v-if="showTools">
          <div class="imp-search">
            <CdIcon icon="lucide:search" :size="15" />
            <input v-model="query" class="imp-search-inp" type="search" placeholder="Search name, company, email" />
            <button v-if="query" type="button" class="imp-search-x" aria-label="Clear search" @click="query = ''">
              <CdIcon icon="lucide:x" :size="14" />
            </button>
          </div>
          <div class="imp-sort">
            <button type="button" :class="{ on: sortMode === 'recent' }" @click="sortMode = 'recent'">
              <CdIcon icon="lucide:clock" :size="12" /> Recent
            </button>
            <button type="button" :class="{ on: sortMode === 'az' }" @click="sortMode = 'az'">
              <CdIcon icon="lucide:arrow-down-a-z" :size="12" /> A–Z
            </button>
          </div>
        </template>

        <div class="imp-bar">
          <button type="button" class="imp-selall" @click="toggleAll">
            <CdIcon :icon="allSelected ? 'lucide:check-square' : 'lucide:square'" :size="15" />
            {{ allSelected ? 'Deselect all' : 'Select all' }}
          </button>
          <span class="imp-count">
            {{ selectedCount }} of {{ rows.length }} selected<template v-if="query"> · {{ visibleRows.length }} shown</template>
          </span>
        </div>

        <div v-if="!visibleRows.length" class="imp-nomatch">
          No matches for “{{ query }}”.
        </div>
        <div v-else class="imp-list">
          <button
            v-for="r in visibleRows"
            :key="r.key"
            type="button"
            class="imp-row glass-thin"
            :class="{ off: !r.selected }"
            @click="r.selected = !r.selected"
          >
            <span class="imp-check" :class="{ on: r.selected }">
              <CdIcon v-if="r.selected" icon="lucide:check" :size="13" />
            </span>
            <span class="imp-av">{{ initials(r.contact.name || '?') }}</span>
            <span class="imp-info">
              <span class="imp-name">
                {{ r.contact.name }}
                <span v-if="r.dupe" class="imp-dupe">already saved</span>
              </span>
              <span v-if="sub(r.contact)" class="imp-meta">{{ sub(r.contact) }}</span>
              <span v-if="contactLine(r.contact)" class="imp-meta dim">{{ contactLine(r.contact) }}</span>
            </span>
          </button>
        </div>

        <div class="imp-addmore-row">
          <button v-if="canPickPhone" type="button" class="imp-addmore" :disabled="reading" @click="pickFromPhone">
            <CdIcon icon="lucide:book-user" :size="14" /> {{ reading ? '…' : 'Add from phone' }}
          </button>
          <button type="button" class="imp-addmore" :disabled="reading" @click="choose">
            <CdIcon icon="lucide:plus" :size="14" /> {{ reading ? '…' : 'Add files' }}
          </button>
        </div>
      </template>
    </div>

    <div v-if="rows.length && !done" class="cd-save-bar">
      <button
        class="cd-abtn g"
        style="font-size: 16px; padding: 13px"
        :disabled="!selectedCount || importing"
        @click="doImport"
      >
        {{ importing ? 'Importing…' : `Import ${selectedCount} contact${selectedCount === 1 ? '' : 's'} →` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.glass-surface {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 65% / 0.14) 0%,
      hsl(var(--glass-h, 220) var(--glass-s, 60%) 45% / 0.05) 50%,
      hsl(var(--glass-h2, 280) var(--glass-s, 60%) 50% / 0.10) 100%),
    rgba(30, 30, 34, 0.50);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(var(--glass-sat, 170%));
  border: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.16);
  box-shadow: var(--glass-inset), var(--glass-shadow, 0 12px 30px -18px rgba(0, 0, 0, 0.4));
}
.glass-thin {
  background: rgba(30, 30, 34, 0.4);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  border: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.12);
}

/* header back link */
.cd-imp-evt-back { color: var(--cd-accent); }
.cd-imp-evt-live {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  background: var(--cd-accent);
  box-shadow: 0 0 7px color-mix(in srgb, var(--cd-accent) 70%, transparent);
  animation: imp-pulse 1.6s ease-in-out infinite;
}
@keyframes imp-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }

/* choose-files hero */
.imp-hero {
  border-radius: 20px; padding: 28px 20px; text-align: center; cursor: pointer;
  transition: transform 0.12s ease, border-color 0.15s;
}
.imp-hero:active { transform: scale(0.995); }
.imp-hero.busy { pointer-events: none; opacity: 0.7; }
.imp-hero-ico { color: var(--cd-accent); line-height: 0; margin-bottom: 12px; }
.imp-hero-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.7rem; color: var(--cd-text); }
.imp-hero-sub { font-size: 0.9rem; line-height: 1.5; color: var(--cd-muted); margin: 6px 0 16px; }
.imp-hero-btn { width: 100%; justify-content: center; font-size: 15px; padding: 13px; pointer-events: none; }
/* Secondary hero (the file option when the phone picker is the primary one) —
   quieter: tighter padding, muted CTA. */
.imp-hero-sec { margin-top: 10px; padding: 20px; }
.imp-hero-sec .imp-hero-title { font-size: 1.35rem; }
.imp-hero-sec .imp-hero-ico { margin-bottom: 8px; color: var(--cd-muted); }
.imp-hero-sec .imp-hero-btn {
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text); box-shadow: none;
}
.imp-hero-sec .imp-hero-btn :deep(svg) { color: var(--cd-accent); }

/* guidance block */
.imp-guide { margin-top: 20px; }
.imp-guide-lbl {
  display: flex; align-items: center; gap: 6px; margin: 0 4px 8px;
  font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--cd-dim);
}
.imp-guide-lbl :deep(svg) { color: var(--cd-accent); }

.imp-evt-note {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: 12px; font-size: 12px; font-weight: 700; color: var(--cd-dim);
}
.imp-evt-note :deep(svg) { color: var(--cd-accent); }
.imp-evt-note span { color: var(--cd-accent); }

/* how-it-works steps */
.imp-steps {
  margin: 0 4px; padding-left: 20px; display: flex; flex-direction: column; gap: 9px;
  font-size: 0.82rem; line-height: 1.45; color: var(--cd-muted);
}
.imp-steps li::marker { color: var(--cd-accent); font-weight: 800; }
.imp-steps b { color: var(--cd-text); }

/* search + sort tools */
.imp-search {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
  padding: 9px 12px; border-radius: 12px;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
}
.imp-search :deep(svg) { color: var(--cd-dim); flex-shrink: 0; }
.imp-search-inp {
  flex: 1; min-width: 0; background: none; border: none; outline: none;
  color: var(--cd-text); font-family: inherit; font-size: 14px;
}
.imp-search-inp::placeholder { color: var(--cd-dim); }
/* Hide the native search-clear so our own X is the only one. */
.imp-search-inp::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }
.imp-search-x {
  display: flex; flex-shrink: 0; padding: 2px; border: none; background: none;
  color: var(--cd-dim); cursor: pointer;
}
.imp-search-x:hover { color: var(--cd-text); }
.imp-sort { display: flex; gap: 6px; margin-bottom: 12px; }
.imp-sort button {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
  background: transparent; border: 1px solid var(--cd-bdr); color: var(--cd-muted);
  font-family: inherit; font-size: 12px; font-weight: 700; transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.imp-sort button :deep(svg) { color: currentColor; }
.imp-sort button.on {
  border-color: var(--cd-accent); color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
}
.imp-nomatch { font-size: 0.86rem; color: var(--cd-muted); padding: 18px 4px; text-align: center; }

/* select bar */
.imp-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.imp-selall {
  display: inline-flex; align-items: center; gap: 7px;
  background: none; border: none; color: var(--cd-accent);
  font-family: inherit; font-size: 13px; font-weight: 800; cursor: pointer;
}
.imp-count { font-size: 12px; font-weight: 700; color: var(--cd-dim); }

/* preview rows */
.imp-list { display: flex; flex-direction: column; gap: 8px; }
.imp-row {
  display: flex; align-items: center; gap: 11px; width: 100%; text-align: left;
  padding: 11px 12px; border-radius: 14px; cursor: pointer; color: var(--cd-text);
  transition: opacity 0.15s, border-color 0.15s;
}
.imp-row.off { opacity: 0.5; }
.imp-check {
  width: 22px; height: 22px; flex-shrink: 0; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--cd-bdr); color: #04120a; transition: background 0.15s, border-color 0.15s;
}
.imp-check.on { background: var(--cd-accent); border-color: var(--cd-accent); }
.imp-av {
  width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.85rem; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
}
.imp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.imp-name {
  font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 7px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.imp-dupe {
  flex-shrink: 0; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--cd-gold, #ffd700); padding: 1px 6px; border-radius: 999px;
  background: color-mix(in srgb, var(--cd-gold, #ffd700) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-gold, #ffd700) 30%, transparent);
}
.imp-meta { font-size: 0.78rem; color: var(--cd-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.imp-meta.dim { color: var(--cd-dim); }

.imp-addmore-row { display: flex; gap: 8px; margin-top: 12px; }
.imp-addmore {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%;
  padding: 11px; border-radius: 12px; cursor: pointer;
  background: transparent; border: 1px dashed var(--cd-bdr); color: var(--cd-muted);
  font-family: inherit; font-size: 13px; font-weight: 700; transition: border-color 0.15s, color 0.15s;
}
.imp-addmore:hover { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); color: var(--cd-accent); }
.imp-addmore:disabled { opacity: 0.6; cursor: default; }

/* done summary */
.imp-summary { border-radius: 22px; padding: 30px 22px; text-align: center; }
.imp-summary-ico { color: var(--cd-gold, #ffd700); line-height: 0; margin-bottom: 6px; }
.imp-summary-count { font-family: 'Bebas Neue', sans-serif; font-size: 5rem; line-height: 0.95; color: var(--cd-accent); }
.imp-summary-title { font-size: 1.05rem; font-weight: 800; color: var(--cd-text); }
.imp-summary-sub { font-size: 0.9rem; line-height: 1.5; color: var(--cd-muted); margin: 10px 0 4px; }
.imp-swap-hint {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin: 14px 0 0; font-size: 0.78rem; font-weight: 700; color: var(--cd-dim); line-height: 1.4;
}
.imp-swap-hint :deep(svg) { color: var(--cd-accent); flex-shrink: 0; }
.imp-cta { width: 100%; justify-content: center; margin-top: 12px; font-size: 15px; padding: 13px; }
.imp-cta-done { margin-top: 8px; font-size: 14px; padding: 11px; }
</style>
