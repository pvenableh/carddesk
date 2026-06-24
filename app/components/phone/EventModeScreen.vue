<script setup lang="ts">
/**
 * Event Mode — a focused capture surface for networking events, rendered as a
 * slide-up panel over the app shell (same sheet pattern as the Earnest chat).
 * While active it auto-tags every new contact with the event name, shows a live
 * count + the people met here, and keeps a one-tap "Scan a card" loop going.
 * Closing the panel doesn't end the event — the app-wide EventPill rides along
 * until the user explicitly ends it here.
 */
const { active, name, captured, count, pastEvents, start, resume, closePanel, saveAndEnd, loadPastEvents, renameEvent, deleteEvent } = useEventMode()
const { enabled: locEnabled, detecting: locDetecting, venues: locVenues, detect: detectLocation } = useLocation()
const { nav, goDetail } = useNavigation()
const { open: openChat } = useChat()
const { show: openShareSheet } = useShareSheet()
const { state: xp } = useXp()

// Hand the past-event snapshots to Earnest AI as a continuable analysis chat.
function analyzeEvents() {
  const events = pastEvents.value.map((ev: any) => {
    const c = ev.messages?.[0]?.content || {}
    return {
      name: ev.title,
      date: ev.date_created,
      count: typeof c.count === 'number' ? c.count : 0,
      contacts: Array.isArray(c.contacts)
        ? c.contacts.slice(0, 12).map((p: any) => ({ name: p.name, company: p.company, title: p.title }))
        : [],
    }
  })
  openChat({
    scope: 'events',
    title: 'Your events',
    context: { events },
    focus: 'their networking event history — the events they\'ve worked and the people they met at each',
    intro: `You've worked ${events.length} ${events.length === 1 ? 'event' : 'events'}. Want me to find who to follow up with first, or spot patterns across them?`,
  })
}

const draftName = ref('')
const summary = ref(false)
const finishing = ref(false)

// Show the user their networking history when they land on the start screen.
// And — since opening this panel means they're about to work an event — detect
// where they are so we can offer the venue as the event name (feature-gated).
onMounted(() => {
  if (!active.value) {
    loadPastEvents()
    if (locEnabled.value && !locVenues.value.length) detectLocation()
  }
})

function useVenueName(venue: string) {
  draftName.value = venue
}

function startEvent() {
  start(draftName.value)
  draftName.value = ''
}
function endEvent() {
  summary.value = true
}
// The scan loop lives on the Add screen underneath — drop the sheet, go there.
function goScan() {
  closePanel()
  nav('add')
}
async function finish() {
  if (finishing.value) return
  finishing.value = true
  // Snapshot the event into history before we clear the live state.
  await saveAndEnd()
  finishing.value = false
  summary.value = false
  closePanel()
  // Land back on the home dashboard rather than whatever screen sat behind the
  // panel (often the Add/scan screen the capture loop came from).
  nav('vibe')
}
function initials(n: string): string {
  return n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
}
function eventDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
function eventCount(s: any): number {
  const c = s?.messages?.[0]?.content
  return typeof c?.count === 'number' ? c.count : 0
}

// ── Past-event management (resume / rename / delete) ──
const openRowId = ref<string | null>(null)
const renamingId = ref<string | null>(null)
const renameVal = ref('')
const confirmDeleteId = ref<string | null>(null)
const rowBusy = ref(false)

function toggleRow(id: string) {
  openRowId.value = openRowId.value === id ? null : id
  renamingId.value = null
  confirmDeleteId.value = null
}
// Resume: flip Event Mode back on with this name. Because membership is a
// `met_at` match, everyone tagged here is instantly back in the live count.
function resumeEvent(ev: any) {
  resume(ev)
  openRowId.value = null
}
function beginRename(ev: any) {
  renamingId.value = ev.id
  renameVal.value = ev.title
  confirmDeleteId.value = null
}
async function doRename(ev: any) {
  if (rowBusy.value) return
  const nn = renameVal.value.trim()
  if (!nn || nn === ev.title) { renamingId.value = null; return }
  rowBusy.value = true
  try { await renameEvent(ev.title, nn) }
  finally { rowBusy.value = false; renamingId.value = null; openRowId.value = null }
}
async function doDelete(ev: any) {
  if (rowBusy.value) return
  rowBusy.value = true
  try { await deleteEvent(ev.id) }
  finally { rowBusy.value = false; confirmDeleteId.value = null; openRowId.value = null }
}
</script>

<template>
  <div class="cd-screen on">
    <div class="cd-shdr">
      <div class="em-hdr-row">
        <!-- Sheet close: while an event runs this just minimizes the panel
             (the EventPill keeps the mode visible app-wide). -->
        <button class="cd-back" type="button" aria-label="Close" @click="closePanel">
          <CdIcon icon="lucide:chevron-down" :size="15" /> Close
        </button>
        <button v-if="active && !summary" class="cd-back em-end" type="button" @click="endEvent">
          <CdIcon icon="lucide:flag" :size="13" /> End event
        </button>
      </div>
      <div class="cd-stitle">Event Mode <CdIcon icon="lucide:radio" :size="16" /></div>
      <!-- The live event's name, clearly under the "Event Mode" header so it's
           obvious which event you're capturing into. -->
      <div v-if="active && !summary" class="em-title">
        <span class="em-title-live"></span>
        <span class="em-title-name">{{ name }}</span>
      </div>
    </div>

    <div class="cd-scrl cd-pad">
      <div class="cd-foot-fill">
      <!-- ── Start screen ── -->
      <template v-if="!active">
        <div class="em-start glass-surface">
          <div class="em-start-ico"><CdIcon icon="lucide:users-round" :size="40" /></div>
          <div class="em-start-title">Going to an event?</div>
          <p class="em-start-sub">
            Turn on Event Mode and every card you scan gets tagged to the event automatically.
            Meet fast, sort later — watch your count climb.
          </p>
          <label class="cd-lbl">Event name</label>
          <input
            v-model="draftName"
            class="cd-inp"
            placeholder="SaaS Summit NYC"
            @keyup.enter="startEvent"
          />
          <!-- Nearby venues (Google Places) — tap one to name the event after the
               place you're at. Hidden when the feature is off. -->
          <div v-if="locEnabled && (locDetecting || locVenues.length)" class="em-venues">
            <div class="em-venues-lbl">
              <CdIcon icon="lucide:map-pin" :size="11" />
              <span v-if="locDetecting">Finding where you are…</span>
              <span v-else>You're nearby — tap to name it</span>
            </div>
            <div v-if="locVenues.length" class="em-venue-chips">
              <button
                v-for="v in locVenues"
                :key="v.name"
                type="button"
                class="em-venue-chip"
                :class="{ on: draftName === v.name }"
                @click="useVenueName(v.name)"
              ><CdIcon icon="lucide:map-pin" :size="10" /> {{ v.name }}</button>
            </div>
          </div>
          <button class="cd-abtn g em-start-btn" @click="startEvent">
            <CdIcon icon="lucide:play" :size="15" /> Start Event Mode
          </button>
        </div>

        <!-- ── Past events (history) ── -->
        <template v-if="pastEvents.length">
          <div class="em-sec-lbl" style="margin-top: 22px">
            <CdIcon icon="lucide:history" :size="12" /> Your past events
          </div>
          <button class="em-analyze glass-thin" @click="analyzeEvents">
            <span class="em-analyze-ico"><CdEarnestMark :size="18" /></span>
            <span class="em-analyze-copy">
              <span class="em-analyze-title">Analyze my past events</span>
              <span class="em-analyze-sub">Ask Earnest who to follow up with — and spot patterns</span>
            </span>
            <CdIcon icon="lucide:arrow-right" :size="16" />
          </button>
          <div class="em-list">
            <div v-for="ev in pastEvents" :key="ev.id" class="em-past glass-thin">
              <button class="em-row em-row-btn" type="button" @click="toggleRow(ev.id)">
                <span class="em-av"><CdIcon icon="lucide:calendar-check" :size="16" /></span>
                <span class="em-row-info">
                  <span class="em-row-name">{{ ev.title }}</span>
                  <span class="em-row-co">{{ eventDate(ev.date_created) }} · {{ ev.summary }}</span>
                </span>
                <span class="em-past-count">{{ eventCount(ev) }}</span>
                <CdIcon class="em-past-caret" :class="{ open: openRowId === ev.id }" icon="lucide:chevron-down" :size="15" />
              </button>

              <!-- Expanded actions: resume / rename / delete -->
              <div v-if="openRowId === ev.id" class="em-past-drawer">
                <!-- Rename input -->
                <div v-if="renamingId === ev.id" class="em-past-rename">
                  <input
                    v-model="renameVal"
                    class="cd-inp"
                    placeholder="Event name"
                    @keyup.enter="doRename(ev)"
                  />
                  <p class="em-past-hint">Re-tags everyone met here.</p>
                  <div class="em-past-btn-row">
                    <button class="cd-abtn g em-past-mini" :disabled="rowBusy" @click="doRename(ev)">
                      {{ rowBusy ? 'Saving…' : 'Save' }}
                    </button>
                    <button class="cd-abtn b em-past-mini" :disabled="rowBusy" @click="renamingId = null">Cancel</button>
                  </div>
                </div>
                <!-- Delete confirm -->
                <div v-else-if="confirmDeleteId === ev.id" class="em-past-confirm">
                  <p class="em-past-hint">Remove from history? Your contacts stay tagged to it.</p>
                  <div class="em-past-btn-row">
                    <button class="cd-abtn em-past-mini em-past-del" :disabled="rowBusy" @click="doDelete(ev)">
                      <CdIcon icon="lucide:trash-2" :size="12" /> {{ rowBusy ? 'Removing…' : 'Remove' }}
                    </button>
                    <button class="cd-abtn b em-past-mini" :disabled="rowBusy" @click="confirmDeleteId = null">Cancel</button>
                  </div>
                </div>
                <!-- Action buttons -->
                <div v-else class="em-past-acts">
                  <button class="em-past-act" type="button" @click="resumeEvent(ev)">
                    <CdIcon icon="lucide:play" :size="13" /> Resume
                  </button>
                  <button class="em-past-act" type="button" @click="beginRename(ev)">
                    <CdIcon icon="lucide:pencil" :size="13" /> Rename
                  </button>
                  <button class="em-past-act danger" type="button" @click="confirmDeleteId = ev.id">
                    <CdIcon icon="lucide:trash-2" :size="13" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- ── Active capture ── -->
      <template v-else-if="!summary">
        <!-- live count hero -->
        <div class="em-hero glass-surface">
          <div class="em-hero-label">Live now</div>
          <div class="em-hero-count">{{ count }}</div>
          <div class="em-hero-unit">{{ count === 1 ? 'person met here' : 'people met here' }}</div>
          <div class="em-hero-streak">
            <CdIcon icon="lucide:flame" :size="12" /> {{ xp.streak }}-day streak · keep it rolling
          </div>
        </div>

        <!-- primary capture loop -->
        <button class="em-scan glass-surface" @click="goScan">
          <span class="em-scan-ico"><CdIcon icon="lucide:scan-line" :size="30" /></span>
          <span class="em-scan-copy">
            <span class="em-scan-title">Scan a card</span>
            <span class="em-scan-sub">+50 XP · auto-tagged to {{ name }}</span>
          </span>
          <CdIcon icon="lucide:arrow-right" :size="18" />
        </button>

        <!-- Share back: hand out your own card / send an invite without leaving
             the capture loop. The global ShareSheet layers above this panel. -->
        <div class="em-share">
          <button class="em-share-btn" type="button" @click="openShareSheet('card')">
            <CdIcon icon="lucide:qr-code" :size="17" />
            <span>My card</span>
          </button>
          <button class="em-share-btn" type="button" @click="openShareSheet('invite')">
            <CdIcon icon="lucide:user-plus" :size="17" />
            <span>Invite</span>
          </button>
        </div>

        <!-- people met here -->
        <div class="em-sec-lbl">
          <CdIcon icon="lucide:user-check" :size="12" /> Met at this event
        </div>
        <div v-if="!captured.length" class="em-empty">
          No one yet — scan your first card to get the count going.
        </div>
        <div v-else class="em-list">
          <button v-for="c in captured" :key="c.id" class="em-row glass-thin" @click="goDetail(c.id)">
            <span class="em-av">{{ initials(c.name || '?') }}</span>
            <span class="em-row-info">
              <span class="em-row-name">{{ c.name }}</span>
              <span class="em-row-co">{{ [c.title, c.company].filter(Boolean).join(' · ') || '—' }}</span>
            </span>
            <CdIcon icon="lucide:chevron-right" :size="15" />
          </button>
        </div>
      </template>

      <!-- ── End summary ── -->
      <template v-else>
        <div class="em-summary glass-surface">
          <div class="em-summary-ico"><CdIcon icon="lucide:party-popper" :size="52" /></div>
          <div class="em-summary-count">{{ count }}</div>
          <div class="em-summary-title">{{ count === 1 ? 'new connection' : 'new connections' }} at {{ name }}</div>
          <p class="em-summary-sub">Nice work. They're all tagged and waiting in your network — sort them into your pipeline whenever you're ready.</p>
          <button class="cd-abtn g em-start-btn" :disabled="finishing" @click="finish">
            <CdIcon icon="lucide:check" :size="15" /> {{ finishing ? 'Saving…' : 'Done' }}
          </button>
          <p class="em-summary-saved"><CdIcon icon="lucide:bookmark" :size="11" /> Saved to your event history</p>
        </div>
      </template>
      </div>

      <CdBrandFooter />
    </div>
  </div>
</template>

<style scoped>
/* shared frosted glass card */
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

/* iOS PWA safe-area: the sheet wrapper handles the top inset; here we keep the
   scrollable content (footer, Done button, the people list) clear of the home
   indicator at the bottom. Selector is intentionally specific enough to win
   over the glass theme's `.cd-pad` padding-bottom. */
.cd-screen .cd-scrl { padding-bottom: max(16px, env(safe-area-inset-bottom, 0px)); }

/* header row: sheet close on the left, end-event on the right */
.em-hdr-row { display: flex; align-items: center; justify-content: space-between; }
.em-end { color: var(--cd-orange, #ff6b35); }

/* Live event title, sitting just under the "Event Mode" header. */
.em-title { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.em-title-name {
  font-size: 16px; font-weight: 800; color: var(--cd-accent);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.em-title-live {
  width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%;
  background: var(--cd-accent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--cd-accent) 70%, transparent);
  animation: em-title-pulse 1.6s ease-in-out infinite;
}
@keyframes em-title-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}

/* start */
.em-start { border-radius: 20px; padding: 26px 20px; text-align: center; }
.em-start-ico { color: var(--cd-green); line-height: 0; margin-bottom: 12px; }
.em-start-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.7rem; color: var(--cd-text); }
.em-start-sub { font-size: 0.9rem; line-height: 1.5; color: var(--cd-muted); margin: 6px 0 16px; }
.em-start .cd-lbl { text-align: left; }
.em-start-btn { width: 100%; justify-content: center; margin-top: 14px; font-size: 15px; padding: 13px; }

/* Nearby-venue suggestions on the start screen. */
.em-venues { text-align: left; margin-top: 10px; }
.em-venues-lbl { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: var(--cd-dim); margin-bottom: 7px; }
.em-venues-lbl :deep(svg) { color: var(--cd-accent); }
.em-venue-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.em-venue-chip {
  display: inline-flex; align-items: center; gap: 4px; max-width: 100%;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text);
  border-radius: 999px; padding: 6px 12px; font-family: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.em-venue-chip :deep(svg) { flex-shrink: 0; color: var(--cd-dim); }
.em-venue-chip:hover { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.em-venue-chip.on {
  border-color: var(--cd-accent); color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
}
.em-venue-chip.on :deep(svg) { color: var(--cd-accent); }

/* hero count */
.em-hero { border-radius: 20px; padding: 22px; text-align: center; margin-bottom: 12px; }
.em-hero-label {
  font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.12em; text-transform: uppercase;
  font-size: 0.85rem; color: var(--cd-muted);
}
.em-hero-count {
  font-family: 'Bebas Neue', sans-serif; font-size: 4.6rem; line-height: 0.95; color: var(--cd-accent);
  text-shadow: 0 6px 30px color-mix(in srgb, var(--cd-accent) 40%, transparent);
}
.em-hero-unit { font-size: 0.95rem; color: var(--cd-text); font-weight: 700; margin-top: 2px; }
.em-hero-streak { font-size: 0.78rem; color: var(--cd-orange); font-weight: 700; margin-top: 8px; }

/* scan loop */
.em-scan {
  width: 100%; display: flex; align-items: center; gap: 14px;
  border-radius: 18px; padding: 16px; margin-bottom: 18px; cursor: pointer;
  color: var(--cd-text); text-align: left;
  transition: transform 0.12s ease, box-shadow 0.16s ease;
}
.em-scan:active { transform: scale(0.99); }
.em-scan-ico {
  width: 52px; height: 52px; flex-shrink: 0; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 34%, transparent);
}
.em-scan-copy { flex: 1; display: flex; flex-direction: column; }
.em-scan-title { font-weight: 800; font-size: 1.05rem; }
.em-scan-sub { font-size: 0.78rem; color: var(--cd-muted); }

/* share-back row (My card / Invite) — secondary to the scan CTA */
.em-share { display: flex; gap: 10px; margin-bottom: 18px; }
.em-share-btn {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 13px; border-radius: 14px; cursor: pointer;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text);
  font-family: inherit; font-size: 0.92rem; font-weight: 700;
  transition: border-color 0.15s, color 0.15s, background 0.15s, transform 0.12s;
}
.em-share-btn :deep(svg) { color: var(--cd-accent); flex-shrink: 0; }
.em-share-btn:hover { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.em-share-btn:active { transform: scale(0.98); }

/* list */
.em-sec-lbl {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 800;
  color: var(--cd-dim); margin: 4px 2px 10px;
}
.em-empty { font-size: 0.85rem; color: var(--cd-muted); padding: 8px 2px 20px; }
.em-list { display: flex; flex-direction: column; gap: 8px; }
.em-row {
  display: flex; align-items: center; gap: 11px; width: 100%; text-align: left;
  padding: 11px 12px; border-radius: 14px; cursor: pointer; color: var(--cd-text);
}
.em-av {
  width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.85rem; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 30%, transparent);
}
.em-row-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.em-row-name { font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.em-row-co { font-size: 0.78rem; color: var(--cd-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* summary */
.em-summary { border-radius: 22px; padding: 30px 22px; text-align: center; }
.em-summary-ico { color: var(--cd-gold, #ffd700); line-height: 0; margin-bottom: 6px; }
.em-summary-count { font-family: 'Bebas Neue', sans-serif; font-size: 5rem; line-height: 0.95; color: var(--cd-accent); }
.em-summary-title { font-size: 1.05rem; font-weight: 800; color: var(--cd-text); }
.em-summary-sub { font-size: 0.9rem; line-height: 1.5; color: var(--cd-muted); margin: 10px 0 4px; }
.em-summary-saved {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  font-size: 0.72rem; color: var(--cd-dim); margin-top: 12px;
}

/* analyze-events CTA */
.em-analyze {
  width: 100%; display: flex; align-items: center; gap: 12px;
  border-radius: 14px; padding: 13px; margin-bottom: 10px; cursor: pointer;
  color: var(--cd-text); text-align: left; transition: transform 0.1s ease, border-color 0.15s;
}
.em-analyze:active { transform: scale(0.99); }
.em-analyze-ico {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; color: var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 32%, transparent);
}
.em-analyze-copy { flex: 1; display: flex; flex-direction: column; }
.em-analyze-title { font-weight: 800; font-size: 0.95rem; }
.em-analyze-sub { font-size: 0.75rem; color: var(--cd-muted); }

/* past-events count pill */
.em-past-count {
  flex-shrink: 0; min-width: 26px; text-align: center;
  font-family: 'Bebas Neue', sans-serif; font-size: 1.1rem; color: var(--cd-accent);
  padding: 2px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--cd-accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 28%, transparent);
}

/* ── manageable past-event rows ── */
.em-past { border-radius: 14px; overflow: hidden; }
.em-row-btn { background: none; border: none; font-family: inherit; }
.em-past-caret { flex-shrink: 0; color: var(--cd-dim); transition: transform 0.2s ease; }
.em-past-caret.open { transform: rotate(180deg); }
.em-past-drawer {
  padding: 4px 12px 12px;
  border-top: 1px solid hsl(var(--glass-h, 220) 30% 75% / 0.10);
}
.em-past-acts { display: flex; gap: 7px; padding-top: 10px; }
.em-past-act {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  padding: 9px 6px; border-radius: 10px;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); color: var(--cd-text);
  font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.em-past-act :deep(svg) { color: var(--cd-accent); }
.em-past-act:hover { border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent); }
.em-past-act.danger { color: var(--cd-orange, #ff6b35); }
.em-past-act.danger :deep(svg) { color: var(--cd-orange, #ff6b35); }
.em-past-act.danger:hover { border-color: color-mix(in srgb, var(--cd-orange, #ff6b35) 45%, transparent); }

.em-past-rename, .em-past-confirm { padding-top: 10px; }
.em-past-rename .cd-inp { margin-bottom: 8px; }
/* Hint sits on its own full-width line above the buttons (it used to share a
   flex row with them and wrap into a jammed column). */
.em-past-hint { display: block; margin: 0 2px 8px; font-size: 10.5px; color: var(--cd-dim); line-height: 1.4; }
.em-past-btn-row { display: flex; gap: 7px; }
/* flex:1 (basis 0) overrides the global .cd-abtn width:100%, so the buttons
   split the row evenly instead of each demanding full width. */
.em-past-mini { flex: 1; width: auto; font-size: 12px; padding: 8px 14px; }
.em-past-del {
  background: color-mix(in srgb, var(--cd-orange, #ff6b35) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-orange, #ff6b35) 34%, transparent);
  color: var(--cd-orange, #ff6b35);
  display: inline-flex; align-items: center; gap: 5px;
}
</style>
