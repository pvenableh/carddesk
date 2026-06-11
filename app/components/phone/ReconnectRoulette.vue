<script setup lang="ts">
/**
 * Reconnect Roulette — a slot-machine spin that surfaces one quiet contact
 * (14+ days since the last touch, or never touched) and dares you to reach out
 * right now. The XP comes only from the real action (same +25/+50 quick-log
 * mechanics as Up Next), so spinning is free fun, not a farmable reward.
 * Three spins a day keeps the wheel feeling like an event, not a feed.
 */
import { getRating, cEmoji } from '~/composables/useConstants'
import { todayStr } from '~/composables/useFormatters'
import type { CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince, logActivity } = useContacts()
const { earn, completeMission } = useXp()
const { goDetail } = useNavigation()
const { error: showError, success } = useToast()
const analytics = useAnalytics()

const MAX_SPINS = 3
const SPINS_KEY = 'cd-roulette-spins'
const today = new Date().toISOString().slice(0, 10)

// Quiet = worth a serendipity nudge, but not already screaming in Up Next.
const pool = computed(() =>
  contacts.value.filter((c) => {
    if (c.hibernated || followUpStatus(c) === 'overdue') return false
    const d = daysSince(c)
    return d === null || d >= 14
  })
)

const spinsUsed = ref(0)
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(SPINS_KEY) || 'null')
    if (saved?.date === today) spinsUsed.value = saved.count ?? 0
  } catch { /* ignore bad cache */ }
})

const spinning = ref(false)
const reel = ref('') // name flashing by while the wheel spins
const picked = ref<CdContact | null>(null)
const logged = ref(false)
const busy = ref(false)
let reelTimer: ReturnType<typeof setTimeout> | null = null
onUnmounted(() => { if (reelTimer) clearTimeout(reelTimer) })

function spin() {
  if (spinning.value || !pool.value.length || spinsUsed.value >= MAX_SPINS) return
  spinning.value = true
  picked.value = null
  logged.value = false
  draft.value = null
  spinsUsed.value++
  try { localStorage.setItem(SPINS_KEY, JSON.stringify({ date: today, count: spinsUsed.value })) } catch { /* quota */ }

  const winner = pool.value[Math.floor(Math.random() * pool.value.length)]
  // Decelerating reel: quick name flips that slow into the reveal.
  let delay = 60
  const tick = () => {
    reel.value = pool.value[Math.floor(Math.random() * pool.value.length)].name
    delay *= 1.18
    if (delay < 320) {
      reelTimer = setTimeout(tick, delay)
    } else {
      reelTimer = setTimeout(() => {
        spinning.value = false
        picked.value = winner
      }, delay)
    }
  }
  tick()
}

// The paid assist: the spin created the intent, Earnest removes the "what do I
// say?" friction. Metered (1 credit) — a 402 opens the buy modal via the
// credit-guard plugin, so no extra toast for that case.
const draft = ref<string | null>(null)
const drafting = ref(false)
async function draftReopener(c: CdContact) {
  if (drafting.value) return
  drafting.value = true
  analytics.aiFeatureUse('roulette_reopener')
  try {
    const lastAct = ((c.activities as any[]) ?? [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    const { message } = await $fetch<{ message: string }>('/api/ai-reopener', {
      method: 'POST',
      body: {
        contact: {
          id: c.id, name: c.name, title: c.title, company: c.company,
          industry: c.industry, met_at: c.met_at, rating: c.rating, notes: c.notes,
          lastActivity: lastAct ? `${lastAct.date}: ${lastAct.label}${lastAct.note ? ` (${lastAct.note})` : ''}` : null,
        },
        daysQuiet: daysSince(c),
      },
    })
    draft.value = message
    completeMission('ai_ideas')
  } catch (err: any) {
    if (err?.statusCode !== 402 && err?.response?.status !== 402)
      showError(err?.data?.message || "Earnest couldn't draft that — try again.")
  } finally { drafting.value = false }
}

async function copyDraft() {
  if (!draft.value) return
  try {
    await navigator.clipboard.writeText(draft.value)
    success('Copied — go send it!')
  } catch { showError("Couldn't copy — select the text manually.") }
}

async function logTouch(c: CdContact) {
  if (busy.value || logged.value) return
  busy.value = true
  try {
    await logActivity({
      contact: c.id, type: 'other', label: 'Roulette reconnect',
      date: todayStr(), is_response: false,
    })
    if (c.rating === 'hot') {
      earn(50, '🎰', `Roulette win — ${c.name.split(' ')[0]} hears from you!`)
      completeMission('hot')
    } else {
      earn(25, '🎰', `Roulette win — ${c.name.split(' ')[0]} hears from you!`)
    }
    completeMission('followup')
    logged.value = true
  } catch { showError("Couldn't log that — try again.") }
  finally { busy.value = false }
}

function quiet(c: CdContact): string {
  const d = daysSince(c)
  const r = getRating(c.rating ?? '')
  return [d != null ? `${d} days quiet` : 'never touched', r?.label].filter(Boolean).join(' · ')
}
</script>

<template>
  <div v-if="pool.length >= 3" class="cd-vc rr">
    <div class="rr-hdr">
      <span class="rr-hdr-ico"><CdIcon emoji="🎰" icon="lucide:dices" :size="13" /></span>
      <span>Reconnect Roulette</span>
      <span class="rr-hdr-spins">{{ MAX_SPINS - spinsUsed }} spin{{ MAX_SPINS - spinsUsed === 1 ? '' : 's' }} left today</span>
    </div>

    <!-- Spinning reel -->
    <div v-if="spinning" class="rr-reel">
      <span class="rr-reel-name">{{ reel }}</span>
    </div>

    <!-- Reveal -->
    <div v-else-if="picked" class="rr-pick">
      <button class="rr-pick-main" type="button" @click="goDetail(picked.id)">
        <span class="rr-av" :class="picked.rating">
          <img v-if="(picked as any).imageUrl" :src="(picked as any).imageUrl" alt="" />
          <CdIcon v-else :emoji="cEmoji(picked)" icon="lucide:user" :size="17" />
        </span>
        <span class="rr-pick-info">
          <span class="rr-pick-name">{{ picked.name }}</span>
          <span class="rr-pick-sub">{{ [picked.title, picked.company].filter(Boolean).join(' · ') || quiet(picked) }}</span>
          <span class="rr-pick-quiet">{{ quiet(picked) }}</span>
        </span>
      </button>
      <div class="rr-acts">
        <a v-if="picked.phone" class="rr-act" :href="`sms:${picked.phone}${draft ? '?&body=' + encodeURIComponent(draft) : ''}`">
          <CdIcon emoji="📱" icon="lucide:message-circle" :size="13" /> Text
        </a>
        <a v-if="picked.email" class="rr-act" :href="`mailto:${picked.email}${draft ? '?body=' + encodeURIComponent(draft) : ''}`">
          <CdIcon emoji="📧" icon="lucide:mail" :size="13" /> Email
        </a>
        <button class="rr-act log" type="button" :disabled="busy || logged" @click="logTouch(picked)">
          <CdIcon :emoji="logged ? '✅' : '✓'" :icon="logged ? 'lucide:check-circle' : 'lucide:check'" :size="13" />
          {{ logged ? 'Logged!' : `Log touch +${picked.rating === 'hot' ? 50 : 25}` }}
        </button>
      </div>

      <!-- Earnest assist: drafts the re-opener (metered) -->
      <button v-if="!draft" class="rr-draft-btn" type="button" :disabled="drafting" @click="draftReopener(picked)">
        <CdEarnestMark :size="13" />
        {{ drafting ? 'Earnest is writing…' : 'Earnest drafts your re-opener · 1 token' }}
      </button>
      <div v-else class="rr-draft">
        <div class="rr-draft-txt">{{ draft }}</div>
        <div class="rr-draft-acts">
          <button class="rr-act" type="button" @click="copyDraft">
            <CdIcon emoji="📋" icon="lucide:copy" :size="12" /> Copy
          </button>
          <button class="rr-act" type="button" :disabled="drafting" @click="draftReopener(picked)">
            <CdIcon icon="lucide:refresh-cw" :size="12" /> {{ drafting ? 'Writing…' : 'Redo · 1 token' }}
          </button>
        </div>
      </div>

      <button
        v-if="spinsUsed < MAX_SPINS" class="rr-respin" type="button" @click="spin"
      >
        <CdIcon icon="lucide:refresh-cw" :size="11" /> Spin again
      </button>
    </div>

    <!-- Idle -->
    <button v-else-if="spinsUsed < MAX_SPINS" class="rr-spin-btn" type="button" @click="spin">
      <span class="rr-spin-ico"><CdIcon emoji="🎰" icon="lucide:dices" :size="22" /></span>
      <span class="rr-spin-copy">
        <span class="rr-spin-t">Spin the wheel</span>
        <span class="rr-spin-b">{{ pool.length }} quiet contacts in the drum — reach out, bank the XP</span>
      </span>
      <CdIcon icon="lucide:play" :size="15" />
    </button>

    <!-- Out of spins -->
    <div v-else class="rr-out">
      <CdIcon emoji="🌙" icon="lucide:moon" :size="13" /> Out of spins — the wheel resets tomorrow.
    </div>
  </div>
</template>

<style scoped>
.rr { border-color: color-mix(in srgb, var(--cd-gold, #ffd700) 24%, transparent); }
.rr-hdr {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;
  color: var(--cd-dim); margin-bottom: 9px;
}
.rr-hdr-ico { color: var(--cd-gold, #ffd700); line-height: 0; }
.rr-hdr-spins { margin-left: auto; font-size: 9px; color: var(--cd-gold, #ffd700); }

.rr-spin-btn {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 11px 12px; border-radius: 13px; cursor: pointer; text-align: left;
  background: var(--cd-bg2); border: 1px dashed color-mix(in srgb, var(--cd-gold, #ffd700) 38%, transparent);
  color: var(--cd-text); font-family: inherit;
  transition: transform 0.1s ease, border-color 0.15s ease;
}
.rr-spin-btn:active { transform: scale(0.98); }
.rr-spin-ico {
  width: 42px; height: 42px; flex-shrink: 0; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--cd-gold, #ffd700);
  background: color-mix(in srgb, var(--cd-gold, #ffd700) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-gold, #ffd700) 28%, transparent);
}
.rr-spin-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.rr-spin-t { font-size: 13.5px; font-weight: 800; }
.rr-spin-b { font-size: 10.5px; color: var(--cd-dim); font-weight: 600; line-height: 1.4; }

.rr-reel {
  display: flex; align-items: center; justify-content: center;
  height: 64px; border-radius: 13px; overflow: hidden;
  background: var(--cd-bg2); border: 1px solid color-mix(in srgb, var(--cd-gold, #ffd700) 30%, transparent);
}
.rr-reel-name {
  font-family: 'Bebas Neue', sans-serif; font-size: 22px; letter-spacing: 1px;
  color: var(--cd-gold, #ffd700);
  animation: rr-blur 0.12s linear infinite;
}
@keyframes rr-blur {
  0% { opacity: 0.4; transform: translateY(6px); filter: blur(1px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

.rr-pick-main {
  display: flex; align-items: center; gap: 11px; width: 100%;
  background: none; border: none; padding: 0 0 9px; cursor: pointer;
  font-family: inherit; color: inherit; text-align: left;
}
.rr-av {
  width: 42px; height: 42px; flex-shrink: 0; border-radius: 50%; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--cd-bg2); border: 1px solid color-mix(in srgb, var(--cd-gold, #ffd700) 38%, transparent);
}
.rr-av img { width: 100%; height: 100%; object-fit: cover; }
.rr-av.hot { border-color: rgba(255, 107, 53, 0.55); }
.rr-pick-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.rr-pick-name { font-size: 14.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rr-pick-sub { font-size: 10.5px; color: var(--cd-muted); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rr-pick-quiet { font-size: 9.5px; color: var(--cd-gold, #ffd700); font-weight: 700; margin-top: 1px; }

.rr-acts { display: flex; gap: 6px; flex-wrap: wrap; }
.rr-act {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 7px 11px; border-radius: 9999px; cursor: pointer; text-decoration: none;
  background: var(--cd-bg2); border: 1px solid var(--cd-bdr);
  color: var(--cd-muted); font-family: inherit; font-size: 11px; font-weight: 800;
  transition: transform 0.1s ease, border-color 0.15s ease, color 0.15s ease;
}
.rr-act:active { transform: scale(0.95); }
.rr-act.log {
  color: var(--cd-accent);
  border-color: color-mix(in srgb, var(--cd-accent) 35%, transparent);
  background: color-mix(in srgb, var(--cd-accent) 10%, transparent);
}
.rr-act:disabled { opacity: 0.6; cursor: default; }
.rr-draft-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; margin-top: 8px; padding: 9px 12px; border-radius: 9999px; cursor: pointer;
  background: transparent; border: 1px dashed rgba(77, 166, 255, 0.45);
  color: #4da6ff; font-family: inherit; font-size: 11.5px; font-weight: 700;
  transition: transform 0.1s ease, border-color 0.15s ease;
}
.rr-draft-btn:active:not(:disabled) { transform: scale(0.98); }
.rr-draft-btn:disabled { opacity: 0.6; cursor: default; }
.rr-draft {
  margin-top: 8px; padding: 10px 12px; border-radius: 12px;
  background: var(--cd-bg2); border: 1px solid rgba(77, 166, 255, 0.3);
}
.rr-draft-txt { font-size: 12.5px; line-height: 1.55; color: var(--cd-text); white-space: pre-wrap; }
.rr-draft-acts { display: flex; gap: 6px; margin-top: 8px; }

.rr-respin {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 8px;
  background: none; border: none; padding: 0; cursor: pointer;
  color: var(--cd-dim); font-family: inherit; font-size: 10.5px; font-weight: 700;
}
.rr-respin:hover { color: var(--cd-gold, #ffd700); }

.rr-out {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 700; color: var(--cd-dim); padding: 2px 0;
}
</style>
