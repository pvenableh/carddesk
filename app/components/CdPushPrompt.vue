<script setup lang="ts">
// One-time-ish prompt to enable push notifications. Lives at the top of
// HomeScreen.vue. Hides itself when:
//   - Push isn't supported on this device.
//   - The user is already subscribed (server confirmed via composable).
//   - The user dismissed it (snoozed 14d) or said "Never".
//   - Permission was already denied (we don't re-prompt; user has to
//     go into browser settings).
//
// Dismissal lives in localStorage — per device — because push subscriptions
// are per device. No server schema change needed.

import { computed, onMounted, ref } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { usePushSubscription } from '~/composables/usePushSubscription'

const SNOOZE_KEY = 'cd-push-snooze-until'
const NEVER_KEY = 'cd-push-never'
const SNOOZE_DAYS = 14

const { loggedIn } = useAuth()
const { support, permission, isSubscribed, loading, subscribe, error } = usePushSubscription()

const snoozeUntil = ref<number>(0)
const never = ref<boolean>(false)
const justEnabled = ref(false)

onMounted(() => {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY)
    snoozeUntil.value = raw ? parseInt(raw, 10) || 0 : 0
    never.value = localStorage.getItem(NEVER_KEY) === '1'
  } catch {
    // localStorage blocked (Safari private) — show the prompt; dismiss won't persist but it won't crash.
  }
})

const snoozedNow = computed(() => Date.now() < snoozeUntil.value)

const visible = computed(() => {
  if (!loggedIn.value) return false
  if (!support.value.canSubscribe || !support.value.pushManager) return false
  if (isSubscribed.value) return false
  if (permission.value === 'denied') return false
  if (never.value) return false
  if (snoozedNow.value) return false
  return true
})

const iosHomeScreenHint = computed(() => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)
  if (!isIOS) return false
  // Show hint when iOS user is NOT yet in standalone mode (can't actually subscribe yet).
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  return !isStandalone
})

async function handleEnable() {
  const sub = await subscribe()
  if (sub) {
    justEnabled.value = true
    // Hide the card after a beat so the success state isn't sticky.
    setTimeout(() => { justEnabled.value = false }, 2500)
  }
}

function snooze() {
  const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000
  snoozeUntil.value = until
  try {
    localStorage.setItem(SNOOZE_KEY, String(until))
  } catch {
    // best-effort
  }
}

function neverShow() {
  never.value = true
  try {
    localStorage.setItem(NEVER_KEY, '1')
  } catch {
    // best-effort
  }
}
</script>

<template>
  <transition name="cd-push-fade">
    <div v-if="visible || justEnabled" class="cd-push-card">
      <div class="cd-push-card__icon">
        <CdIcon emoji="🔔" icon="lucide:bell-ring" :size="20" />
      </div>
      <div class="cd-push-card__body">
        <div class="cd-push-card__title">
          <template v-if="justEnabled">You're in. Pushes on.</template>
          <template v-else>Get nudged at the right moment</template>
        </div>
        <div class="cd-push-card__copy">
          <template v-if="justEnabled">We'll ping you when a follow-up's due or a streak's about to break.</template>
          <template v-else-if="iosHomeScreenHint">
            iPhone needs CardDesk on your Home Screen first. Tap Share → Add to Home Screen, then come back.
          </template>
          <template v-else>
            Follow-ups due, streaks about to break, cards you scanned on another device.
          </template>
        </div>
        <div v-if="error" class="cd-push-card__err">{{ error }}</div>
        <div v-if="!justEnabled" class="cd-push-card__actions">
          <CdButton tier="primary" size="sm" :disabled="loading || iosHomeScreenHint" @click="handleEnable">
            <span v-if="loading">Enabling…</span>
            <span v-else>Enable notifications</span>
          </CdButton>
          <button class="cd-push-card__txt" type="button" @click="snooze">Later</button>
          <button class="cd-push-card__txt cd-push-card__txt--quiet" type="button" @click="neverShow">Never</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.cd-push-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  margin-bottom: 11px;
  background: linear-gradient(135deg, rgba(0, 255, 135, 0.08), rgba(0, 200, 110, 0.04));
  border: 1px solid rgba(0, 255, 135, 0.22);
  border-radius: 16px;
}

.cd-push-card__icon {
  flex: 0 0 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(0, 255, 135, 0.16);
  color: #00ff87;
  display: grid;
  place-items: center;
}

.cd-push-card__body {
  flex: 1 1 auto;
  min-width: 0;
}

.cd-push-card__title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 18px;
  letter-spacing: 0.5px;
  color: #f0f7ff;
  margin-bottom: 4px;
}

.cd-push-card__copy {
  font-size: 12px;
  line-height: 1.5;
  color: #aab6c8;
  margin-bottom: 10px;
}

.cd-push-card__err {
  font-size: 11px;
  color: #ff7466;
  margin-bottom: 8px;
}

.cd-push-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cd-push-card__txt {
  background: transparent;
  border: none;
  color: #8898b0;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  padding: 4px 2px;
}

.cd-push-card__txt:hover {
  color: #c6d2e3;
}

.cd-push-card__txt--quiet {
  color: #5f6c80;
}

.cd-push-fade-enter-active,
.cd-push-fade-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.cd-push-fade-enter-from,
.cd-push-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
