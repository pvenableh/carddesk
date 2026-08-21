<script setup lang="ts">
/**
 * Notifications + version panel for the account screen.
 *
 * Push subscriptions are PER DEVICE, so this is deliberately a device-scoped
 * control: it reports what THIS phone/browser is doing, and the test push tells
 * you how many of the account's devices actually received something — which is
 * how you find out the old phone is still subscribed.
 *
 * The version block below it exists for the same reason support asks "what
 * version are you on?": it names the build, says whether it's current, and lets
 * someone force the check rather than waiting for the poll.
 */
const { support, permission, swReady, standalone, isSubscribed, loading, error, subscribe, unsubscribe, refreshState } =
  usePushSubscription()
const { current, pending, applyUpdate, checkNow, applying } = useAppUpdate()

const testing = ref(false)
const testResult = ref<string>('')
const checking = ref(false)
const checkedMsg = ref('')

const isIos = computed(() => {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document)
})

/**
 * Chrome/Edge/Firefox on iPhone, AND no active service worker to show for it.
 *
 * Gated on the evidence rather than the user agent alone: if one of those
 * browsers ever does run a worker, the toggle should work instead of being
 * refused on principle. Until then this is the honest read — the worker never
 * activates there, so push cannot be enabled no matter what the UI offers.
 */
const needsSafari = computed(() => support.value.iosThirdParty && swReady.value === false)

/** iOS only allows web push from a Home-Screen install (16.4+), never a tab. */
const needsHomeScreen = computed(() => isIos.value && !needsSafari.value && !support.value.canSubscribe)

/**
 * What a phone can't tell you on its own. Push failures on iOS are all
 * invisible — no prompt, no console, no error — so the three facts that decide
 * whether it CAN work are printed where the person debugging can read them.
 */
const diagnostics = computed(() => {
  const parts = [
    `permission: ${permission.value}`,
    `installed: ${standalone.value ? 'yes' : 'no'}`,
    `worker: ${swReady.value === null ? 'checking' : swReady.value ? 'ready' : 'not ready'}`,
    support.value.browser,
  ]
  return parts.join(' · ')
})

const statusLabel = computed(() => {
  if (isSubscribed.value) return 'On for this device'
  if (needsSafari.value) return 'Not possible in this browser'
  if (permission.value === 'denied') return 'Blocked in browser settings'
  if (needsHomeScreen.value) return 'Add to Home Screen first'
  if (!support.value.pushManager) return 'Not supported on this browser'
  return 'Off for this device'
})

async function toggle() {
  if (isSubscribed.value) await unsubscribe()
  else await subscribe()
  testResult.value = ''
}

async function sendTest() {
  testing.value = true
  testResult.value = ''
  try {
    const res = await $fetch<{ sent: number; failed: number }>('/api/push/test', { method: 'POST' })
    testResult.value =
      res.sent > 0
        ? `Sent to ${res.sent} device${res.sent === 1 ? '' : 's'}. It should land in a second.`
        : "No devices received it — try turning notifications off and on again."
  } catch (err: any) {
    testResult.value = err?.data?.message || 'Could not send a test notification.'
  } finally {
    testing.value = false
  }
}

async function checkForUpdate() {
  checking.value = true
  checkedMsg.value = ''
  try {
    const live = await checkNow()
    // `pending` flips via checkNow when the build ids differ.
    checkedMsg.value = pending.value ? '' : live ? "You're on the latest version." : 'Could not reach the server.'
  } finally {
    checking.value = false
  }
}

const builtAt = computed(() => {
  if (!current.value.builtAt) return ''
  const d = new Date(current.value.builtAt)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})

onMounted(() => refreshState())
</script>

<template>
  <div class="acct-section">
    <div class="acct-section-title">Notifications</div>
    <div class="cd-ns-card">
      <div class="cd-ns-row">
        <div class="cd-ns-ico" :class="{ 'cd-ns-ico--on': isSubscribed }">
          <CdIcon emoji="🔔" :icon="isSubscribed ? 'lucide:bell-ring' : 'lucide:bell-off'" :size="17" />
        </div>
        <div class="cd-ns-copy">
          <div class="cd-ns-label">Push notifications</div>
          <div class="cd-ns-status">{{ statusLabel }}</div>
        </div>
        <button
          v-if="support.pushManager && permission !== 'denied' && !needsHomeScreen && !needsSafari"
          type="button"
          class="cd-ns-btn"
          :class="{ 'cd-ns-btn--off': isSubscribed }"
          :disabled="loading"
          @click="toggle"
        >
          {{ loading ? '…' : isSubscribed ? 'Turn off' : 'Turn on' }}
        </button>
      </div>

      <p class="cd-ns-help">
        Follow-ups that are due, streaks about to break, and cards you scanned on another device.
        Each device you use CardDesk on turns these on separately.
      </p>

      <!-- The dead end worth naming: every iPhone browser is WebKit, but only
           Safari's service workers actually run, so Chrome can't get here no
           matter how it was added to the Home Screen. -->
      <p v-if="needsSafari" class="cd-ns-note">
        iPhone only allows notifications from a Home Screen app added with <strong>Safari</strong>.
        Chrome, Edge and Firefox on iPhone can't run the background worker push needs — even from a
        Home Screen shortcut. Open CardDesk in Safari, tap Share → Add to Home Screen, and turn
        notifications on from there.
      </p>
      <p v-else-if="needsHomeScreen" class="cd-ns-note">
        iPhone only allows notifications once CardDesk is on your Home Screen. Tap Share → Add to
        Home Screen, open it from there, then come back.
      </p>
      <p v-else-if="permission === 'denied'" class="cd-ns-note">
        Your browser is blocking notifications for CardDesk. Re-allow them in site settings, then
        reload this page.
      </p>
      <p v-if="error" class="cd-ns-err">{{ error }}</p>

      <!-- Always available, not just once THIS device is subscribed: the test
           reaches every device on the account, so "0 devices" is itself the
           answer when a phone silently failed to subscribe. -->
      <div class="cd-ns-test">
        <button type="button" class="cd-ns-ghost" :disabled="testing" @click="sendTest">
          <CdIcon icon="lucide:send" :size="13" /> {{ testing ? 'Sending…' : 'Send a test notification' }}
        </button>
        <span v-if="testResult" class="cd-ns-testmsg">{{ testResult }}</span>
        <span class="cd-ns-diag">{{ diagnostics }}</span>
      </div>

      <!-- ── Version ───────────────────────────────────────────────────────── -->
      <div class="cd-ns-sep"></div>
      <div class="cd-ns-row">
        <div class="cd-ns-ico"><CdIcon emoji="✨" icon="lucide:git-commit-horizontal" :size="17" /></div>
        <div class="cd-ns-copy">
          <div class="cd-ns-label">App version</div>
          <div class="cd-ns-status cd-ns-mono">
            {{ current.short || current.buildId?.slice(0, 7) || 'dev' }}
            <span v-if="current.ref"> · {{ current.ref }}</span>
          </div>
          <div v-if="builtAt" class="cd-ns-built">Built {{ builtAt }}</div>
        </div>
        <button
          v-if="pending"
          type="button"
          class="cd-ns-btn"
          :disabled="applying"
          @click="applyUpdate()"
        >
          {{ applying ? 'Updating…' : 'Update' }}
        </button>
        <button v-else type="button" class="cd-ns-btn cd-ns-btn--off" :disabled="checking" @click="checkForUpdate">
          {{ checking ? '…' : 'Check' }}
        </button>
      </div>
      <p v-if="pending" class="cd-ns-note cd-ns-note--go">
        A newer version is ready. Updating reloads CardDesk here and in any other tab you have open.
      </p>
      <p v-else-if="checkedMsg" class="cd-ns-help cd-ns-help--tight">{{ checkedMsg }}</p>
    </div>
  </div>
</template>

<style scoped>
.cd-ns-card {
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-bdr);
  border-radius: 12px;
  padding: 14px;
}
.cd-ns-row {
  display: flex;
  align-items: center;
  gap: 11px;
}
.cd-ns-ico {
  flex: 0 0 36px;
  height: 36px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--cd-muted) 14%, transparent);
  color: var(--cd-muted);
}
.cd-ns-ico--on {
  background: color-mix(in srgb, var(--cd-accent) 16%, transparent);
  color: var(--cd-accent);
}
.cd-ns-copy { flex: 1; min-width: 0; }
.cd-ns-label { font-size: 13px; font-weight: 700; color: var(--cd-text); }
.cd-ns-status { font-size: 11px; font-weight: 600; color: var(--cd-muted); }
.cd-ns-mono { font-family: ui-monospace, SFMono-Regular, monospace; letter-spacing: 0.01em; }
.cd-ns-built { font-size: 10px; color: var(--cd-dim); margin-top: 1px; }
.cd-ns-btn {
  flex-shrink: 0;
  cursor: pointer;
  border: none;
  border-radius: 9999px;
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: var(--cd-accent, #0a8cf5);
}
.cd-ns-btn--off {
  background: transparent;
  color: var(--cd-muted);
  border: 1px solid var(--cd-bdr);
}
.cd-ns-btn:disabled { opacity: 0.6; cursor: default; }
.cd-ns-help {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cd-muted);
  margin: 10px 0 0;
}
.cd-ns-help--tight { margin-top: 8px; }
.cd-ns-note {
  font-size: 11px;
  line-height: 1.5;
  color: var(--cd-dim);
  margin: 8px 0 0;
}
.cd-ns-note--go { color: var(--cd-muted); }
.cd-ns-err { font-size: 11px; color: #ff7466; margin: 8px 0 0; }
.cd-ns-test {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.cd-ns-ghost {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--cd-bdr);
  background: transparent;
  color: var(--cd-muted);
  border-radius: 9999px;
  padding: 7px 13px;
  font-size: 12px;
  font-weight: 700;
}
.cd-ns-ghost:disabled { opacity: 0.6; cursor: default; }
.cd-ns-testmsg { font-size: 11px; color: var(--cd-muted); line-height: 1.45; }
.cd-ns-diag {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  color: var(--cd-dim);
  letter-spacing: 0.01em;
}
.cd-ns-sep {
  height: 1px;
  background: var(--cd-bdr);
  margin: 14px -14px;
}
</style>
