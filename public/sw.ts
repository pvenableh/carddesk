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
//   4. Version plumbing — the worker is the one part of CardDesk that runs
//      when no page does, so it doubles as an update channel: it purges the
//      previous build's runtime caches on activate, and re-checks /api/version
//      whenever it wakes for a push, telling any open client that it is stale.
//   5. The home-screen app-icon badge, which can only be set from here (a push
//      usually lands with no page open).
//
// Push payload contract (set by CardDesk's send-side helpers):
//   { title, body?, url?, tag?, icon?, badge?, data? }
//
// iOS notes: push only works on iOS 16.4+ AND only when the app is
// installed to Home Screen. The SW still installs in a Safari tab but
// pushManager.subscribe will reject — see app/composables/usePushSubscription.

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>
}

// 1) Precache
//
// cleanupOutdatedCaches() must be registered BEFORE precacheAndRoute so the
// activate handler it installs runs first: it deletes precaches written by
// earlier Workbox revisions, which is what stops an old build's app shell from
// shadowing a fresh deploy on a device that has been installed for months.
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST || [])

// 2) Runtime caching — replicates the previous generateSW rules.
//
// AUTH/SESSION MUST NEVER BE CACHED. `/api/_auth/session` (nuxt-auth-utils) and
// `/api/auth/*` decide whether the user is logged in — they're just server-side
// cookie work, with no offline value. Caching them meant that on a PWA resume
// over a slow radio (NetworkFirst falls back to cache after 3s) the app could
// read a STALE or pre-login EMPTY session and bounce the user to /login. That
// was the "logged out too quickly on iPhone" bug. Skip them so the session read
// always hits the network; only other GET /api/* data is cached for offline.
const AUTH_ROUTE = /^\/api\/(_auth|auth)\b/
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && !AUTH_ROUTE.test(url.pathname),
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
const RUNTIME_CACHES = ['cd-api', 'cd-images']

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // A new build's API shapes and image URLs may not match what the previous
      // build cached. NetworkFirst would happily serve those old bodies for an
      // hour on a slow radio, which reads to the user as "the update didn't
      // land". Drop them; fonts and the badge counter survive (immutable /
      // deliberately persistent).
      await purgeRuntimeCaches()
      await self.clients.claim()
      // clients.claim() fires `controllerchange` in every controlled page, which
      // app/plugins/app-update.client.ts turns into a reload. This message is
      // for anything that wasn't controlled yet.
      await notifyClients({ type: 'cd-sw-activated' })
    })(),
  )
})

self.addEventListener('message', (event) => {
  const msg = event.data
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  // The page is authoritative about the badge whenever a page is open.
  if (msg.type === 'badge') {
    event.waitUntil(setBadge(msg.count))
    return
  }
  if (msg.type === 'CHECK_VERSION') {
    event.waitUntil(broadcastVersion())
  }
})

// 4) Version plumbing.

/** Post a message to every open CardDesk window, controlled or not. */
async function notifyClients(msg: Record<string, unknown>): Promise<void> {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) client.postMessage(msg)
  } catch (err) {
    console.warn('[sw] client notify failed', err)
  }
}

/**
 * Ask the server which build is live and tell the pages about it. The page
 * compares that id against its own and decides what to do (see
 * app/plugins/app-update.client.ts) — the worker deliberately doesn't decide,
 * because it has no idea what the user is in the middle of.
 *
 * This is what makes an INSTALLED app self-heal: the worker wakes for a push
 * even when the app has been closed for a week, so the staleness is discovered
 * before the user ever opens it.
 */
async function broadcastVersion(): Promise<void> {
  try {
    const res = await fetch('/api/version', {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache' },
      credentials: 'omit',
    })
    if (!res.ok) return
    const data = await res.json()
    if (data && data.buildId) await notifyClients({ type: 'cd-version', buildId: data.buildId })
  } catch {
    // Offline, or the push arrived faster than the network — the page's own
    // poll will catch it.
  }
}

// 5) App-icon badge.

/* ── App-icon badge ──────────────────────────────────────────────────────────
 * The badge on the installed icon (home screen / macOS dock) has to be set from
 * HERE: a push usually arrives with no page open, so page-side code can only
 * ever correct a badge, never raise one.
 *
 * The count is persisted in Cache Storage (one synthetic Response holding a
 * number) because the worker is killed between pushes and nothing else survives.
 * The page wins whenever it is open — useAppBadge posts the real count over
 * postMessage, which overwrites whatever we counted here.
 */
const BADGE_CACHE = 'cd-badge'
const BADGE_KEY = '/__badge'

async function readBadge(): Promise<number> {
  try {
    const cache = await caches.open(BADGE_CACHE)
    const res = await cache.match(BADGE_KEY)
    if (!res) return 0
    const n = Number(await res.text())
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

async function writeBadge(n: number): Promise<void> {
  try {
    const cache = await caches.open(BADGE_CACHE)
    await cache.put(BADGE_KEY, new Response(String(n)))
  } catch {
    /* storage refused — the badge below is still applied for this session */
  }
}

/** Push the number at the OS. No-op where the Badging API isn't supported. */
function applyBadge(n: number): void {
  const nav = self.navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (!nav || typeof nav.setAppBadge !== 'function') return
  if (n > 0) nav.setAppBadge(n).catch(() => {})
  else nav.clearAppBadge?.().catch(() => {})
}

/** Absolute set (the server told us the count, or the page synced it). */
async function setBadge(n: unknown): Promise<void> {
  const v = Math.max(0, Math.floor(Number(n) || 0))
  await writeBadge(v)
  applyBadge(v)
}

/** Relative bump, for pushes that carry no count of their own. */
async function bumpBadge(delta: number): Promise<void> {
  const v = Math.max(0, (await readBadge()) + delta)
  await writeBadge(v)
  applyBadge(v)
}

// 6) Push handlers
//
// Payload contract:
//   { title, body?, url?, tag?, icon?, badge?, badgeCount?, silent?, type?, data? }
//
// `type: 'app-update'` is the deploy ping (server/api/push/broadcast.post.ts):
// it carries no user-facing news, it exists purely to wake this worker so it can
// purge stale caches and tell any open window that a new build is live. With
// `silent: true` it shows no notification at all — see the note below on why
// that is safe here and would not be for a routine notification.
self.addEventListener('push', (event) => {
  let payload: any = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'CardDesk', body: event.data ? event.data.text() : '' }
  }

  const isUpdatePing = payload.type === 'app-update'
  // Every push is a free chance to notice we're behind — the worker is awake and
  // online, which is exactly the moment a week-old install can self-heal.
  const work: Promise<unknown>[] = [broadcastVersion()]

  if (isUpdatePing) {
    // Drop the previous build's runtime caches now, so the next launch reads
    // fresh even if the user never opens the app while it is still online.
    work.push(purgeRuntimeCaches())
  }

  // A push that shows no notification burns the browser's "silent push" budget;
  // spend it only on the update ping, which is rare (one per deploy) and has
  // nothing to say. Everything else always shows something, because
  // userVisibleOnly:true is the promise we made when subscribing.
  if (!(isUpdatePing && payload.silent !== false)) {
    const title: string = payload.title || 'CardDesk'
    work.push(
      self.registration.showNotification(title, {
        body: payload.body || '',
        tag: payload.tag || 'carddesk-notification',
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/icon-192.png',
        data: { url: payload.url || '/', ...(payload.data || {}) },
        renotify: false,
      } as NotificationOptions),
    )
    // The server's count wins when it sends one; otherwise this push is worth
    // exactly one badge.
    work.push(
      typeof payload.badgeCount === 'number' ? setBadge(payload.badgeCount) : bumpBadge(1),
    )
    // An open window should show the new row in the bell without waiting for a
    // reload — the inbox is the durable record, this is just the nudge to refetch.
    work.push(notifyClients({ type: 'cd-notification' }))
  }

  event.waitUntil(Promise.all(work))
})

/** Shared by activate and the update ping — see the activate handler's note. */
async function purgeRuntimeCaches(): Promise<void> {
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => RUNTIME_CACHES.includes(k)).map((k) => caches.delete(k)))
  } catch (err) {
    console.warn('[sw] runtime cache purge failed', err)
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl: string = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      // Opening the app is reading it — clear the icon badge, and let the page
      // re-sync the true count on load (useAppBadge).
      await setBadge(0)
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
