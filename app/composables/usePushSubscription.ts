// CardDesk Web Push registration. Mirrors Earnest's composable — same
// API shape so the prompt component reads the same way. The SW is
// registered by @vite-pwa/nuxt (auto-register), so we don't call
// navigator.serviceWorker.register here — we wait on .ready instead.

import { computed, onMounted, ref } from 'vue'

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const padding = '='.repeat((4 - (b64url.length % 4)) % 4)
  const base64 = (b64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export interface PushSupport {
  serviceWorker: boolean
  pushManager: boolean
  notification: boolean
  canSubscribe: boolean
  /** A third-party browser on iOS (Chrome, Edge, Firefox, an in-app webview).
   *  Push is impossible there — see detectSupport. */
  iosThirdParty: boolean
  /** Short label for the diagnostics line: 'safari-ios', 'chrome-ios', … */
  browser: string
}

/** Chrome, Edge, Firefox, Opera and every in-app webview on iOS. */
const IOS_THIRD_PARTY_UA = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|Twitter/i

function detectSupport(): PushSupport {
  const none = {
    serviceWorker: false, pushManager: false, notification: false,
    canSubscribe: false, iosThirdParty: false, browser: 'server',
  }
  if (typeof window === 'undefined') return none

  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)
  /**
   * Every browser on iOS is WebKit, but only Safari (and a web app added to the
   * Home Screen FROM Safari) gets working service workers. In Chrome/Edge/
   * Firefox on iPhone `navigator.serviceWorker` and `PushManager` both exist and
   * both are useless: registration never activates, so `.ready` hangs forever
   * and the only symptom is a timeout. Detect it by UA — there's nothing to
   * feature-detect, which is the whole problem.
   */
  const iosThirdParty = isIOS && IOS_THIRD_PARTY_UA.test(ua)
  const browser = isIOS
    ? (/CriOS/i.test(ua) ? 'chrome-ios'
      : /EdgiOS/i.test(ua) ? 'edge-ios'
      : /FxiOS/i.test(ua) ? 'firefox-ios'
      : iosThirdParty ? 'webview-ios'
      : 'safari-ios')
    : 'other'

  const swSupport = 'serviceWorker' in navigator
  const pushSupport = 'PushManager' in window
  const notifSupport = 'Notification' in window
  if (!swSupport || !pushSupport || !notifSupport) {
    return { serviceWorker: swSupport, pushManager: pushSupport, notification: notifSupport, canSubscribe: false, iosThirdParty, browser }
  }

  // On iOS, `navigator.standalone` is Safari's own flag and the only one that
  // means what we need. A Home Screen shortcut made from Chrome can still match
  // `display-mode: standalone` while being a browser tab in a costume — which is
  // exactly how someone ends up staring at a service-worker timeout.
  const isStandalone = isIOS
    ? (navigator as any).standalone === true
    : window.matchMedia?.('(display-mode: standalone)').matches === true

  const canSubscribe = !isIOS || (isStandalone && !iosThirdParty)
  return { serviceWorker: swSupport, pushManager: pushSupport, notification: notifSupport, canSubscribe, iosThirdParty, browser }
}

/**
 * `navigator.serviceWorker.ready` never rejects — on iOS it can simply hang
 * when activation stalls, which used to leave the toggle spinning with nothing
 * to show for it. Racing a timeout turns that into a visible error.
 */
async function getReadyRegistration(timeoutMs = 8000): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])
  } catch (err) {
    console.error('[cd push] SW ready failed:', err)
    return null
  }
}

/**
 * Ask for notification permission — FIRST, before anything is awaited.
 *
 * This is the whole iOS bug in one line. WebKit only honours
 * `requestPermission()` while the tap that triggered it still counts as user
 * activation, and activation does not survive an `await` on an unrelated
 * promise. Waiting on the service worker (or the VAPID key) before asking meant
 * iPhone users were never prompted at all: no dialog, no error, permission
 * silently stuck at 'default'.
 *
 * Older WebKit only shipped the callback form, so both are handled.
 */
function requestPermission(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    try {
      const maybe = Notification.requestPermission((perm) => resolve(perm))
      if (maybe && typeof (maybe as any).then === 'function') (maybe as Promise<NotificationPermission>).then(resolve)
    } catch (err) {
      console.error('[cd push] requestPermission threw:', err)
      resolve(Notification.permission)
    }
  })
}

export function usePushSubscription() {
  const support = ref<PushSupport>(detectSupport())
  const permission = ref<NotificationPermission | 'unknown'>('unknown')
  /** Whether the service worker ever reached 'ready' — the settings panel shows
   *  it, because on a phone there's no console to find this out from. */
  const swReady = ref<boolean | null>(null)
  const standalone = ref(false)
  const subscription = ref<PushSubscription | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isSubscribed = computed(() => !!subscription.value)

  async function refreshState() {
    support.value = detectSupport()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      permission.value = Notification.permission
    }
    standalone.value =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true)
    if (!support.value.canSubscribe) return
    const reg = await getReadyRegistration()
    swReady.value = Boolean(reg)
    if (!reg) return
    try {
      subscription.value = await reg.pushManager.getSubscription()
    } catch (err) {
      console.error('[cd push] getSubscription failed:', err)
    }
  }

  async function subscribe() {
    error.value = null
    if (!support.value.canSubscribe) {
      error.value = 'Add CardDesk to your Home Screen first to enable push.'
      return null
    }
    // Before any await — see requestPermission(). Everything else can wait; the
    // browser's permission dialog cannot.
    const perm = await requestPermission()
    permission.value = perm
    if (perm !== 'granted') {
      error.value =
        perm === 'denied'
          ? 'Permission denied — re-allow notifications in your browser settings.'
          : 'Permission not granted — the prompt was dismissed.'
      return null
    }

    loading.value = true
    try {
      const reg = await getReadyRegistration()
      if (!reg)
        throw new Error(
          support.value.iosThirdParty
            ? "This browser can't run notifications on iPhone — open CardDesk in Safari and add it to your Home Screen."
            : "Service worker isn't ready — reopen CardDesk and try again",
        )

      const { key } = await $fetch<{ key: string }>('/api/push/vapid-public-key')
      if (!key) throw new Error('VAPID key not configured')

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast: TS 5.7 types Uint8Array as Uint8Array<ArrayBufferLike>, which no
        // longer satisfies BufferSource on its own. Pre-existing, tidied here.
        applicationServerKey: base64UrlToUint8Array(key) as BufferSource,
      })
      const payload = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(sub.getKey('p256dh')),
          auth: arrayBufferToBase64Url(sub.getKey('auth')),
        },
        user_agent: navigator.userAgent,
      }
      await $fetch('/api/push/subscribe', { method: 'POST', body: payload })

      subscription.value = sub
      return sub
    } catch (err: any) {
      console.error('[cd push] subscribe failed:', err)
      error.value = err?.message || 'Could not enable push notifications'
      return null
    } finally {
      loading.value = false
    }
  }

  async function unsubscribe() {
    error.value = null
    loading.value = true
    try {
      const sub = subscription.value || (await (await getReadyRegistration())?.pushManager.getSubscription())
      if (!sub) return true
      const endpoint = sub.endpoint
      try {
        await sub.unsubscribe()
      } catch (err) {
        console.error('[cd push] browser unsubscribe failed (continuing):', err)
      }
      try {
        await $fetch('/api/push/subscribe', { method: 'DELETE', body: { endpoint } })
      } catch (err) {
        console.error('[cd push] server unsubscribe failed:', err)
      }
      subscription.value = null
      return true
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    refreshState()
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data
        if (data?.type === 'push-navigate' && typeof data.url === 'string') {
          try {
            const router = useRouter()
            router.push(data.url)
          } catch {
            window.location.href = data.url
          }
        }
      })
    }
  })

  return {
    support,
    permission,
    swReady,
    standalone,
    subscription,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    refreshState,
  }
}
