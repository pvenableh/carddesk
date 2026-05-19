<script setup lang="ts">
/**
 * CdInstallPrompt
 *
 *   • iOS Safari → "tap Share → Add to Home Screen" hint (no native API).
 *   • Android / desktop Chrome+Edge → captures the `beforeinstallprompt`
 *     event and exposes an Install CTA.
 *   • Hidden when already running as a standalone PWA, when dismissed
 *     for 7 days, or when permanently dismissed.
 */
type DeferredInstall = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'cd-install-dismiss-until'
const PERMA_KEY = 'cd-install-never'

const visible = ref(false)
const platform = ref<'ios' | 'android' | null>(null)
const deferred = ref<DeferredInstall | null>(null)

function isStandalone() {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia('(display-mode: standalone)').matches
  // iOS sets navigator.standalone instead of matching the media query
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return mq || !!ios
}

function isIOS() {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

function isDismissed() {
  if (typeof localStorage === 'undefined') return false
  if (localStorage.getItem(PERMA_KEY) === '1') return true
  const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
  return until > Date.now()
}

function snooze() {
  const week = 1000 * 60 * 60 * 24 * 7
  localStorage.setItem(DISMISS_KEY, String(Date.now() + week))
  visible.value = false
}

function neverShowAgain() {
  localStorage.setItem(PERMA_KEY, '1')
  visible.value = false
}

async function install() {
  if (!deferred.value) return
  await deferred.value.prompt()
  const { outcome } = await deferred.value.userChoice
  if (outcome === 'accepted') localStorage.setItem(PERMA_KEY, '1')
  deferred.value = null
  visible.value = false
}

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferred.value = e as DeferredInstall
  if (!isDismissed() && !isStandalone()) {
    platform.value = 'android'
    visible.value = true
  }
}

function onAppInstalled() {
  localStorage.setItem(PERMA_KEY, '1')
  visible.value = false
}

onMounted(() => {
  if (isStandalone() || isDismissed()) return

  if (isIOS()) {
    platform.value = 'ios'
    visible.value = true
    return
  }

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)
})

onUnmounted(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', onAppInstalled)
})
</script>

<template>
  <Transition name="cd-installp">
    <div v-if="visible" class="cd-installp" role="dialog" aria-label="Install CardDesk">
      <div class="cd-installp-icon" aria-hidden="true">
        <img src="/icons/icon-192.png" width="44" height="44" alt="" />
      </div>
      <div class="cd-installp-body">
        <div class="cd-installp-title">Install CardDesk</div>
        <p v-if="platform === 'ios'" class="cd-installp-hint">
          Tap <span class="cd-installp-share">⬆</span> Share, then
          <strong>Add to Home Screen</strong>.
        </p>
        <p v-else class="cd-installp-hint">
          Get the full-screen, offline-ready app — one tap to install.
        </p>
      </div>
      <div class="cd-installp-actions">
        <CdButton
          v-if="platform === 'android'"
          tier="primary"
          size="sm"
          @click="install"
        >
          Install
        </CdButton>
        <button class="cd-installp-close" @click="snooze" aria-label="Dismiss for a week">
          ×
        </button>
        <button class="cd-installp-never" @click="neverShowAgain">
          Don't show again
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cd-installp {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 84px);
  z-index: 200;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--cd-bg2);
  color: var(--cd-text);
  border: 1px solid var(--cd-bdr);
  border-radius: 18px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
  max-width: 560px;
  margin: 0 auto;
}
html[data-theme="glass"] .cd-installp {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}
html[data-theme="glass"][data-mode="dark"] .cd-installp {
  background: rgba(28, 30, 32, 0.82);
}
.cd-installp-icon img {
  border-radius: 12px;
  display: block;
}
.cd-installp-title {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 2px;
}
.cd-installp-hint {
  font-size: 12px;
  line-height: 1.35;
  color: var(--cd-dim);
  margin: 0;
}
.cd-installp-hint strong {
  color: var(--cd-text);
  font-weight: 700;
}
.cd-installp-share {
  display: inline-block;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--cd-bg);
  color: var(--cd-accent);
  font-weight: 700;
}
.cd-installp-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.cd-installp-close {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--cd-dim);
  font-size: 22px;
  line-height: 1;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 999px;
}
.cd-installp-close:hover { color: var(--cd-text); }
.cd-installp-never {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--cd-dim);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 4px;
  cursor: pointer;
}
.cd-installp-never:hover { color: var(--cd-text); }

.cd-installp-enter-active,
.cd-installp-leave-active {
  transition: transform 320ms cubic-bezier(0.36, 0.66, 0.04, 1),
              opacity 220ms ease;
}
.cd-installp-enter-from,
.cd-installp-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
