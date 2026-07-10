/// <reference lib="webworker" />
//
// CardDesk service worker.
// vite-pwa-nuxt compiles this in `injectManifest` strategy and rewrites
// self.__WB_MANIFEST with the precache list at build time.
//
// Responsibilities:
//   1. App-shell precaching (Workbox).
//   2. Runtime caching (API/fonts/images — moved here from nuxt.config.ts
//      when we switched off `generateSW`).
//   3. Web Push handlers — show notification + open/focus on click.
//
// Push payload contract (set by CardDesk's send-side helpers):
//   { title, body?, url?, tag?, icon?, badge?, data? }
//
// iOS notes: push only works on iOS 16.4+ AND only when the app is
// installed to Home Screen. The SW still installs in a Safari tab but
// pushManager.subscribe will reject — see app/composables/usePushSubscription.

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>
}

// 1) Precache
precacheAndRoute(self.__WB_MANIFEST || [])

// 2) Runtime caching — replicates the previous generateSW rules.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'cd-api',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'cd-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'cd-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
)

// 2b) Web Share Target receiver. The manifest points share_target.action at
// /share-target (POST, multipart). That path has no server route — this handler
// owns it: it reads the shared .vcf file(s)/text, stashes the raw payload in a
// cache the page can read, and 303-redirects into the app, which ingests it on
// load (see index.vue → ingestSharedCard) and opens the Import screen.
//
// Scoped tightly to POST /share-target so every other request falls through to
// the Workbox routes above untouched.
const SHARE_CACHE = 'cd-share'
const SHARE_KEY = '/__shared_vcard'

self.addEventListener('fetch', (event: FetchEvent) => {
  const req = event.request
  if (req.method !== 'POST') return
  let pathname = ''
  try { pathname = new URL(req.url).pathname } catch { return }
  if (pathname !== '/share-target') return

  event.respondWith(
    (async () => {
      try {
        const form = await req.formData()
        const parts: string[] = []
        for (const f of form.getAll('cards')) {
          if (f && typeof (f as Blob).text === 'function') parts.push(await (f as Blob).text())
        }
        const text = form.get('text')
        const url = form.get('url')
        if (typeof text === 'string' && text.trim()) parts.push(text.trim())
        if (typeof url === 'string' && url.trim()) parts.push(url.trim())
        const cache = await caches.open(SHARE_CACHE)
        await cache.put(
          SHARE_KEY,
          new Response(parts.join('\n'), { headers: { 'Content-Type': 'text/plain' } }),
        )
      } catch (err) {
        // Redirect anyway — the page simply finds no payload and does nothing.
        console.error('[sw] share-target ingest failed', err)
      }
      return Response.redirect(new URL('/?shared=1', self.location.origin).toString(), 303)
    })(),
  )
})

// 3) SW lifecycle. We deliberately DON'T skipWaiting on install: a freshly
// built SW stays in "waiting" so the app can surface a "Refresh" prompt
// (registerType:'prompt' + $pwa.needRefresh → AppUpdateToast). It activates
// only when the user taps refresh, which calls updateServiceWorker() and posts
// {type:'SKIP_WAITING'} to this worker. clients.claim() still runs on activate
// so the very first SW controls the page immediately (offline works without a
// manual reload).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// 4) Push handlers
self.addEventListener('push', (event) => {
  let payload: any = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'CardDesk', body: event.data ? event.data.text() : '' }
  }

  const title: string = payload.title || 'CardDesk'
  const body: string = payload.body || ''
  const url: string = payload.url || '/'
  const tag: string = payload.tag || 'carddesk-notification'
  const icon: string = payload.icon || '/icons/icon-192.png'
  const badge: string = payload.badge || '/icons/icon-192.png'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon,
      badge,
      data: { url, ...(payload.data || {}) },
      renotify: false,
    } as NotificationOptions),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl: string = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        try {
          const u = new URL(client.url)
          if (u.origin === self.location.origin) {
            await client.focus()
            if ('navigate' in client) {
              try {
                await (client as WindowClient).navigate(targetUrl)
              } catch {
                client.postMessage({ type: 'push-navigate', url: targetUrl })
              }
            } else {
              client.postMessage({ type: 'push-navigate', url: targetUrl })
            }
            return
          }
        } catch {
          // Skip invalid URLs
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
