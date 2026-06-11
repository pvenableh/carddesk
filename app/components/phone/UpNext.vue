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
import type { CdContact } from '~/types/directus'

const { contacts, followUpStatus, daysSince, logActivity, wake } = useContacts()
const { state: xp, earn, completeMission } = useXp()
const { goDetail, nav } = useNavigation()
const { error: showError } = useToast()

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

async function quickLog(c: CdContact) {
  if (busyId.value) return
  busyId.value = c.id
  try {
    await logActivity({
      contact: c.id, type: 'other', label: 'Quick follow-up',
      date: todayStr(), is_response: false,
    })
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

    <TransitionGroup name="cd-unrow">
      <div v-for="c in queue" :key="c.id" class="cd-un-row">
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
        <a v-if="c.phone" class="cd-un-act" :href="`sms:${c.phone}`" aria-label="Text them">
          <CdIcon emoji="📱" icon="lucide:message-circle" :size="14" />
        </a>
        <a v-else-if="c.email" class="cd-un-act" :href="`mailto:${c.email}`" aria-label="Email them">
          <CdIcon emoji="📧" icon="lucide:mail" :size="14" />
        </a>
        <button
          class="cd-un-act log" type="button" :disabled="busyId === c.id"
          :aria-label="`Log a touch with ${c.name}`"
          @click="quickLog(c)"
        >
          <CdIcon emoji="✓" icon="lucide:check" :size="13" />
          <span>{{ c.rating === 'hot' ? '+50' : '+25' }}</span>
        </button>
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
.cd-un-row {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 0;
}
.cd-un-row + .cd-un-row { border-top: 1px solid var(--cd-bdr); }
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
.cd-un-act:disabled { opacity: 0.5; cursor: default; }
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
/* Rows clear themselves once actioned — slide out instead of vanishing. */
.cd-unrow-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.cd-unrow-leave-to { opacity: 0; transform: translateX(14px); }
</style>
