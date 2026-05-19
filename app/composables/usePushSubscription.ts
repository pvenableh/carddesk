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
}

function detectSupport(): PushSupport {
  if (typeof window === 'undefined') {
    return { serviceWorker: false, pushManager: false, notification: false, canSubscribe: false }
  }
  const swSupport = 'serviceWorker' in navigator
  const pushSupport = 'PushManager' in window
  const notifSupport = 'Notification' in window
  if (!swSupport || !pushSupport || !notifSupport) {
    return { serviceWorker: swSupport, pushManager: pushSupport, notification: notifSupport, canSubscribe: false }
  }
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)
  const canSubscribe = !isIOS || isStandalone
  return { serviceWorker: swSupport, pushManager: pushSupport, notification: notifSupport, canSubscribe }
}

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch (err) {
    console.error('[cd push] SW ready failed:', err)
    return null
  }
}

export function usePushSubscription() {
  const support = ref<PushSupport>(detectSupport())
  const permission = ref<NotificationPermission | 'unknown'>('unknown')
  const subscription = ref<PushSubscription | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isSubscribed = computed(() => !!subscription.value)

  async function refreshState() {
    support.value = detectSupport()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      permission.value = Notification.permission
    }
    if (!support.value.canSubscribe) return
    const reg = await getReadyRegistration()
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
    loading.value = true
    try {
      const reg = await getReadyRegistration()
      if (!reg) throw new Error('Service worker not ready')

      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') {
        error.value = perm === 'denied' ? 'Permission denied' : 'Permission not granted'
        return null
      }

      const { key } = await $fetch<{ key: string }>('/api/push/vapid-public-key')
      if (!key) throw new Error('VAPID key not configured')

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(key),
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
    subscription,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    refreshState,
  }
}
