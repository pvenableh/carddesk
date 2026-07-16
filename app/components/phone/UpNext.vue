<script setup lang="ts">
/**
 * "Up next" — the next-best-action queue at the top of Vibe. The follow-up cron
 * already knows who's slipping (push notifications); this surfaces the same
 * logic in-app as the first thing you see: the top overdue/due contacts (hot
 * first) with one-tap log/text/email, plus one revival candidate. Rows clear
 * themselves as you act — logging a touch updates followUpStatus, so the queue
 * shrinks live. Networking apps die at follow-up, not capture; this is the
 * follow-up half of the loop.
 */
import { getRating, cEmoji } from '~/composables/useConstants'
import { todayStr } from '~/composables/useFormatters'
import { MAX_STREAK_SHIELDS } from '~/composables/useXp'
import { SOCIALS, socialUrl } from '~/types/socials'
import type { CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince, lastActivity, logActivity, wake } = useContacts()
const { state: xp, earn, completeMission } = useXp()
const { goDetail, nav } = useNavigation()
const { error: showError, success: showOk } = useToast()

const RANK: Record<string, number> = { hot: 0, warm: 1, nurture: 2, cold: 3 }
const byHeat = (a: CdContact, b: CdContact) =>
  (RANK[a.rating ?? ''] ?? 4) - (RANK[b.rating ?? ''] ?? 4)

const queue = computed(() => {
  const active = contacts.value.filter((c) => !c.hibernated)
  const overdue = active.filter((c) => followUpStatus(c) === 'overdue').sort(byHeat)
  const due = active.filter((c) => followUpStatus(c) === 'due').sort(byHeat)
  return [...overdue, ...due].slice(0, 3)
})

// One revival candidate — waking a sleeping relationship outranks a new scan.
const revival = computed(() => contacts.value.find((c) => c.hibernated) ?? null)
const coldCount = computed(() => contacts.value.filter((c) => c.rating === 'cold' && !c.hibernated).length)

const busyId = ref<string | null>(null)

// Log a follow-up touch (any channel) + award XP. The queue watches
// followUpStatus, so a logged touch clears the row on its own.
async function logTouch(c: CdContact, type: string, label: string) {
  if (busyId.value) return
  busyId.value = c.id
  try {
    await logActivity({ contact: c.id, type: type as any, label, date: todayStr(), is_response: false })
    if (c.rating === 'hot') {
      earn(50, '⚡', "Don't leave them hanging.")
      completeMission('hot')
    } else {
      earn(25, '✉️', "They'll remember you.")
    }
    completeMission('followup')
  } catch { showError("Couldn't log that — try again.") }
  finally { busyId.value = null }
}

function quickLog(c: CdContact) {
  return logTouch(c, 'other', 'Quick follow-up')
}

// ─── Inline "draft & send" ────────────────────────────────────────────────
// A subtle prompt: expand a suggested opener, then send it in one tap via any
// channel the contact actually has. Text/email prefill the native app; social
// copies the note and opens the profile (no app lets a link prefill a DM).
const draftFor = ref<string | null>(null)
const draftText = ref('')
const draftAiLoading = ref(false)
let tmplIdx = 0

function firstName(c: CdContact) {
  return (c.name || '').trim().split(/\s+/)[0] || 'there'
}

// Free, instant, personalized openers — the frictionless default. Redraft cycles.
function template(c: CdContact, i: number): string {
  const f = firstName(c)
  const co = (c as any).company ? ` at ${(c as any).company}` : ''
  const opts = [
    `Hey ${f} — it's been a bit! How are things${co}? Would love to catch up soon.`,
    `Hi ${f}, you crossed my mind today. How have you been?`,
    `Hey ${f} — long overdue for a proper catch-up. Free for a quick coffee or call in the next week or two?`,
    `Hi ${f}! Hope all's well. Wanted to reconnect — what have you been up to lately?`,
  ]
  return opts[i % opts.length]
}

function openDraft(c: CdContact) {
  if (draftFor.value === c.id) { closeDraft(); return }
  tmplIdx = 0
  draftText.value = template(c, 0)
  draftFor.value = c.id
}
function closeDraft() {
  draftFor.value = null
  draftAiLoading.value = false
}
function redraft(c: CdContact) {
  tmplIdx += 1
  draftText.value = template(c, tmplIdx)
}

// Optional upgrade: an Earnest AI-written re-opener (metered, 1 credit).
async function aiDraft(c: CdContact) {
  if (draftAiLoading.value) return
  draftAiLoading.value = true
  try {
    const la = lastActivity(c)
    const { message } = await $fetch<{ message: string }>('/api/ai-reopener', {
      method: 'POST',
      body: {
        contact: {
          id: c.id, name: c.name, title: (c as any).title, company: (c as any).company,
          industry: (c as any).industry, met_at: (c as any).met_at, rating: c.rating,
          notes: (c as any).notes, lastActivity: la ? `${la.label} (${la.date})` : null,
        },
        daysQuiet: daysSince(c),
      },
    })
    if (message) draftText.value = message
  } catch (err: any) {
    showError(err?.data?.message ?? "Earnest couldn't draft that — try again.")
  } finally {
    draftAiLoading.value = false
  }
}

// Channels this contact can actually receive on, in priority order.
function channelsFor(c: CdContact) {
  const out: { key: string; label: string; icon: string; social?: any }[] = []
  if (c.phone) out.push({ key: 'text', label: 'Text', icon: 'lucide:message-circle' })
  if (c.email) out.push({ key: 'email', label: 'Email', icon: 'lucide:mail' })
  for (const s of SOCIALS) if ((c as any)[s.key]) out.push({ key: s.key, label: s.label, icon: s.mono, social: s })
  return out
}

function smsHref(c: CdContact) {
  return `sms:${c.phone}?&body=${encodeURIComponent(draftText.value)}`
}
function mailHref(c: CdContact) {
  return `mailto:${c.email}?subject=${encodeURIComponent('Catching up')}&body=${encodeURIComponent(draftText.value)}`
}

// Text / email are real <a> taps (native prefill). This just records the touch.
function afterSend(c: CdContact, type: string) {
  logTouch(c, type, `Reached out via ${type}`)
  closeDraft()
}

// Social can't prefill a DM — copy the note, open the profile, log the touch.
async function sendSocial(c: CdContact, chan: { key: string; label: string; social: any }) {
  try { await navigator.clipboard?.writeText(draftText.value) } catch { /* clipboard may be blocked */ }
  const url = socialUrl(chan.social.key, (c as any)[chan.key])
  if (url) window.open(url, '_blank', 'noopener')
  showOk(`Note copied — paste it in ${chan.label}.`)
  logTouch(c, SOCIALS.some((s) => s.key === chan.key && ['linkedin'].includes(s.key)) ? chan.key : 'other', `Reached out via ${chan.label}`)
  closeDraft()
}

async function revive(c: CdContact) {
  if (busyId.value) return
  busyId.value = c.id
  try {
    await wake(c.id)
    // Revival also banks a streak shield — acts of recovery earn resilience.
    earn(75, '🌅', `${c.name.split(' ')[0]} is back in orbit!`, {
      streak_shields: Math.min(MAX_STREAK_SHIELDS, (xp.value.streak_shields ?? 0) + 1),
    })
    useFeed().emit('revival', {})
  } catch { showError("Couldn't revive that contact — try again.") }
  finally { busyId.value = null }
}

function sub(c: CdContact): string {
  const d = daysSince(c)
  const r = getRating(c.rating ?? '')
  return [d != null ? `${d}d quiet` : 'no touch yet', r?.label].filter(Boolean).join(' · ')
}
</script>

<template>
  <div v-if="contacts.length" class="cd-vc cd-upnext">
    <div class="cd-un-hdr">
      <CdIcon emoji="⚡" icon="lucide:list-todo" :size="12" />
      <span>Up next</span>
      <span v-if="queue.length" class="cd-un-count">{{ queue.length }}</span>
    </div>

    <TransitionGroup name="cd-unrow" tag="div" class="cd-un-list">
      <div v-for="c in queue" :key="c.id" class="cd-un-item" :class="{ 'is-open': draftFor === c.id }">
        <div class="cd-un-row">
          <button class="cd-un-main" type="button" @click="goDetail(c.id)">
            <span class="cd-un-av" :class="c.rating">
              <img v-if="(c as any).imageUrl" :src="(c as any).imageUrl" alt="" />
              <CdIcon v-else :emoji="cEmoji(c)" icon="lucide:user" :size="16" />
            </span>
            <span class="cd-un-info">
              <span class="cd-un-name">{{ c.name }}</span>
              <span class="cd-un-sub" :class="c.rating">
                <CdIcon v-if="c.rating === 'hot'" emoji="🔥" icon="lucide:flame" :size="10" />
                {{ sub(c) }}
              </span>
            </span>
          </button>
          <button
            v-if="channelsFor(c).length"
            class="cd-un-act draft" :class="{ on: draftFor === c.id }" type="button"
            :aria-label="`Draft a message to ${c.name}`" :aria-expanded="draftFor === c.id"
            @click="openDraft(c)"
          >
            <CdIcon emoji="✍️" icon="lucide:sparkles" :size="13" />
            <span>Draft</span>
          </button>
          <button
            class="cd-un-act log" type="button" :disabled="busyId === c.id"
            :aria-label="`Log a touch with ${c.name}`"
            @click="quickLog(c)"
          >
            <CdIcon emoji="✓" icon="lucide:check" :size="13" />
            <span>{{ c.rating === 'hot' ? '+50' : '+25' }}</span>
          </button>
        </div>

        <!-- Inline draft: suggested opener + one-tap channel send -->
        <Transition name="cd-un-drawer">
          <div v-if="draftFor === c.id" class="cd-un-draft" @click.stop>
            <textarea
              v-model="draftText" class="cd-un-draft-txt" rows="3"
              :placeholder="`A quick note to ${firstName(c)}…`"
            />
            <div class="cd-un-draft-tools">
              <button type="button" class="cd-un-chip" @click="redraft(c)">
                <CdIcon emoji="🔁" icon="lucide:refresh-cw" :size="11" /> Redraft
              </button>
              <button type="button" class="cd-un-chip ai" :disabled="draftAiLoading" @click="aiDraft(c)">
                <CdIcon :emoji="draftAiLoading ? '⏳' : '✨'" :icon="draftAiLoading ? 'lucide:loader-circle' : 'lucide:sparkles'" :size="11" :class="{ 'cd-spin': draftAiLoading }" />
                {{ draftAiLoading ? 'Drafting…' : 'Earnest draft' }}
              </button>
            </div>
            <div class="cd-un-send">
              <template v-for="ch in channelsFor(c)" :key="ch.key">
                <a v-if="ch.key === 'text'" class="cd-un-sendbtn" :href="smsHref(c)" @click="afterSend(c, 'text')">
                  <CdIcon :icon="ch.icon" :size="13" /> {{ ch.label }}
                </a>
                <a v-else-if="ch.key === 'email'" class="cd-un-sendbtn" :href="mailHref(c)" @click="afterSend(c, 'email')">
                  <CdIcon :icon="ch.icon" :size="13" /> {{ ch.label }}
                </a>
                <button v-else type="button" class="cd-un-sendbtn" @click="sendSocial(c, ch as any)">
                  <CdIcon :icon="ch.icon" :size="13" /> {{ ch.label }}
                </button>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </TransitionGroup>

    <div v-if="!queue.length && !revival" class="cd-un-done">
      <CdIcon emoji="✅" icon="lucide:check-circle" :size="13" /> All caught up — nobody's slipping away.
    </div>

    <!-- Revival: pull a hibernated contact back into orbit -->
    <div v-if="revival" class="cd-un-row revive">
      <button class="cd-un-main" type="button" @click="goDetail(revival.id)">
        <span class="cd-un-av rev"><CdIcon emoji="🌅" icon="lucide:sunrise" :size="15" /></span>
        <span class="cd-un-info">
          <span class="cd-un-name">{{ revival.name }}</span>
          <span class="cd-un-sub rev">hibernating — bring them back</span>
        </span>
      </button>
      <button
        class="cd-un-act revive" type="button" :disabled="busyId === revival.id"
        @click="revive(revival)"
      >
        <CdIcon emoji="🌅" icon="lucide:sunrise" :size="13" />
        <span>Revive +75</span>
      </button>
    </div>

    <button v-if="coldCount" class="cd-un-cold" type="button" @click="nav('cold')">
      <CdIcon emoji="❄️" icon="lucide:snowflake" :size="11" />
      {{ coldCount }} cold contact{{ coldCount > 1 ? 's' : '' }} worth warming
      <CdIcon icon="lucide:chevron-right" :size="11" />
    </button>
  </div>
</template>

<style scoped>
.cd-upnext { border-color: color-mix(in srgb, var(--cd-accent) 22%, transparent); }
.cd-un-hdr {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--cd-dim); margin-bottom: 8px;
}
.cd-un-count {
  min-width: 17px; height: 17px; padding: 0 5px; border-radius: 9999px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; color: #060810; background: var(--cd-accent);
}
.cd-un-item + .cd-un-item { border-top: 1px solid var(--cd-bdr); }
.cd-un-row {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 0;
}
.cd-un-main {
  flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px;
  background: none; border: none; padding: 0; cursor: pointer;
  font-family: inherit; color: inherit; text-align: left;
}
.cd-un-av {
  width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
}
.cd-un-av img { width: 100%; height: 100%; object-fit: cover; }
.cd-un-av.hot { border-color: rgba(255, 107, 53, 0.5); }
.cd-un-av.rev { color: var(--cd-gold, #ffd700); border-color: rgba(255, 215, 0, 0.35); }
.cd-un-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cd-un-name {
  font-size: 13px; font-weight: 700;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cd-un-sub { font-size: 10px; color: var(--cd-dim); font-weight: 600; }
.cd-un-sub.hot { color: #ff6b35; }
.cd-un-sub.rev { color: var(--cd-gold, #ffd700); }
.cd-un-act {
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 3px;
  height: 28px; min-width: 28px; padding: 0 7px; border-radius: 9999px;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
  color: var(--cd-muted); font-size: 10px; font-weight: 800; font-family: inherit;
  cursor: pointer; text-decoration: none;
  transition: transform 0.1s ease, border-color 0.15s ease, color 0.15s ease;
}
.cd-un-act:active { transform: scale(0.94); }
.cd-un-act.log {
  color: var(--cd-accent);
  border-color: color-mix(in srgb, var(--cd-accent) 35%, transparent);
  background: color-mix(in srgb, var(--cd-accent) 10%, transparent);
}
.cd-un-act.revive {
  color: var(--cd-gold, #ffd700);
  border-color: rgba(255, 215, 0, 0.35);
  background: rgba(255, 215, 0, 0.08);
}
.cd-un-act.draft.on {
  color: var(--cd-accent);
  border-color: color-mix(in srgb, var(--cd-accent) 40%, transparent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
}
.cd-un-act:disabled { opacity: 0.5; cursor: default; }

/* ── Inline draft panel ── */
.cd-un-draft { padding: 4px 0 8px; }
.cd-un-draft-txt {
  width: 100%; box-sizing: border-box; resize: none;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr); border-radius: 10px;
  padding: 9px 11px; color: var(--cd-text); font-family: inherit; font-size: 12.5px; line-height: 1.5;
  transition: border-color 0.15s ease;
}
.cd-un-draft-txt:focus { outline: none; border-color: color-mix(in srgb, var(--cd-accent) 45%, transparent); }
.cd-un-draft-tools { display: flex; gap: 6px; margin: 7px 0; }
.cd-un-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 9px; border-radius: 9999px;
  background: transparent; border: 1px solid var(--cd-bdr);
  color: var(--cd-muted); font-family: inherit; font-size: 10.5px; font-weight: 700; cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
}
.cd-un-chip:hover { color: var(--cd-text); }
.cd-un-chip:active { transform: scale(0.95); }
.cd-un-chip.ai {
  color: var(--cd-accent);
  border-color: color-mix(in srgb, var(--cd-accent) 32%, transparent);
  background: color-mix(in srgb, var(--cd-accent) 8%, transparent);
}
.cd-un-chip:disabled { opacity: 0.6; cursor: default; }
.cd-un-send { display: flex; gap: 6px; }
.cd-un-sendbtn {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  height: 34px; padding: 0 8px; border-radius: 10px;
  background: color-mix(in srgb, var(--cd-accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 28%, transparent);
  color: var(--cd-accent); font-family: inherit; font-size: 11.5px; font-weight: 800;
  cursor: pointer; text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}
.cd-un-sendbtn:hover { background: color-mix(in srgb, var(--cd-accent) 16%, transparent); }
.cd-un-sendbtn:active { transform: scale(0.97); }
/* Drawer expand/collapse for the draft panel */
.cd-un-drawer-enter-active, .cd-un-drawer-leave-active {
  transition: opacity 0.2s ease, transform 0.24s var(--cd-ease-ios, cubic-bezier(0.32, 0.72, 0, 1)), max-height 0.24s var(--cd-ease-ios, cubic-bezier(0.32, 0.72, 0, 1));
  overflow: hidden;
}
.cd-un-drawer-enter-from, .cd-un-drawer-leave-to { opacity: 0; transform: translateY(-4px); max-height: 0; }
.cd-un-drawer-enter-to, .cd-un-drawer-leave-from { max-height: 220px; }

.cd-un-done {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 700; color: var(--cd-accent); padding: 2px 0 4px;
}
.cd-un-cold {
  display: flex; align-items: center; gap: 5px; width: 100%;
  margin-top: 6px; padding: 6px 0 2px; border: none; border-top: 1px solid var(--cd-bdr);
  background: none; color: var(--cd-dim); font-size: 10.5px; font-weight: 700;
  font-family: inherit; cursor: pointer;
}
.cd-un-cold:hover { color: #a8d8ea; }
/* Positioning context so a leaving (absolute) row doesn't escape the list. */
.cd-un-list { position: relative; }
/* Rows enter with a soft fade-up, slide out once actioned, and glide to their
 * new slot when the queue reorders (leaving row is taken out of flow so the
 * survivors animate up smoothly). */
.cd-unrow-enter-active { transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
.cd-unrow-enter-from { opacity: 0; transform: translateY(8px); }
.cd-unrow-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; position: absolute; width: 100%; }
.cd-unrow-leave-to { opacity: 0; transform: translateX(14px); }
.cd-unrow-move { transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
</style>
