import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * Git-traceable release stamp, resolved at BUILD time and baked into the client.
 *
 * This is the human-readable half of the version system: it tells you WHICH
 * commit a given client is running (surfaced in the account footer and logged to
 * the console on boot). It is deliberately NOT the update oracle — Nuxt's own
 * `app.buildId` is, because it is a fresh random hash on every build, so even a
 * rebuild of the same commit invalidates open clients. See
 * app/plugins/app-update.client.ts.
 */
function releaseStamp() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NUXT_PUBLIC_RELEASE_SHA ||
    (() => {
      try {
        return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      } catch {
        return ''
      }
    })()
  return {
    sha,
    short: sha ? sha.slice(0, 7) : '',
    ref: process.env.VERCEL_GIT_COMMIT_REF || '',
    builtAt: new Date().toISOString(),
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 },

  experimental: {
    // A lazy route chunk that 404s means this client is running against a build
    // that no longer exists on the CDN — the app is already broken, so there is
    // nothing to ask about. Reload straight onto the current build.
    emitRouteChunkError: 'automatic-immediate',
    // How often an open client re-checks Nuxt's build manifest (checked around
    // route changes). The default is an hour; an installed PWA stays open for
    // days, so check far more eagerly. One of five signals — see
    // app/plugins/app-update.client.ts.
    checkOutdatedBuildInterval: 1000 * 60 * 5,
  },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'CardDesk',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'CardDesk' },
        { name: 'theme-color', content: '#060810' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/favicon-16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/icons/apple-touch-icon.png' },
      ],
    },
  },
  modules: [
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/fonts',
    'nuxt-auth-utils',
    '@vueuse/nuxt',
    '@vite-pwa/nuxt',
    'nuxt-gtag',
  ],
  // Google Analytics (GA4). Only loads in production, so dev/preview traffic
  // never pollutes the property. Defaults to the CardDesk measurement id;
  // override per-environment with NUXT_PUBLIC_GTAG_ID if needed.
  gtag: {
    id: process.env.NUXT_PUBLIC_GTAG_ID || 'G-RE0F0ZCCV9',
    enabled: process.env.NODE_ENV === 'production',
  },
  nitro: {
    // Compiled MJML email HTML lives here as static assets and is read at
    // runtime via useStorage('assets:emails'). It is NOT bundled/transformed —
    // MJML's HTML breaks the server bundle's esbuild transform, so it must stay
    // an asset. See server/utils/emails/README.md.
    // Absolute path on purpose: Nitro resolves a relative `dir` differently in
    // dev (relative to server/) vs the prod build (relative to the project root),
    // which silently empties the mount in one of them. fileURLToPath pins it to
    // the real folder in both. See server/utils/emails/README.md.
    serverAssets: [
      { baseName: 'emails', dir: fileURLToPath(new URL('./server/assets/emails', import.meta.url)) },
    ],
  },
  pwa: {
    // injectManifest so we own the SW source — needed for Web Push push +
    // notificationclick handlers (generateSW can't host custom listeners).
    // Workbox precaching + the previous runtime-caching rules live inside
    // public/sw.ts now.
    //
    // srcDir is '../public' rather than 'public' because Nuxt 4 sets vite's
    // root to app/, so a plain 'public' would resolve to app/public/sw.ts
    // (which doesn't exist). The leading ../ walks out to the project root
    // where the SW source actually lives.
    strategies: 'injectManifest',
    srcDir: '../public',
    filename: 'sw.ts',
    // 'prompt' (not 'autoUpdate'): a new deploy surfaces a non-intrusive
    // "Refresh" toast (AppUpdateToast, bound to $pwa.needRefresh) instead of
    // silently reloading the page mid-interaction. The new SW stays in
    // "waiting" until the user taps refresh — see the SKIP_WAITING handler in
    // public/sw.ts, which must NOT skipWaiting on install for this to work.
    registerType: 'prompt',
    injectRegister: 'auto',
    manifest: {
      name: 'CardDesk',
      short_name: 'CardDesk',
      description: 'Your contact pipeline, in your pocket.',
      lang: 'en',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#060810',
      background_color: '#060810',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      // Web Share Target — on platforms that support it (Android / desktop
      // Chrome, installed as a PWA), CardDesk shows up in the native share sheet
      // when someone shares a contact card. The shared `.vcf` (or text/url) is
      // POSTed to /share-target, which the service worker intercepts, stashes,
      // and hands to the Import screen. iOS Safari has no share-target support,
      // so there the file-import path on the Import screen is the way in.
      share_target: {
        action: '/share-target',
        method: 'POST',
        enctype: 'multipart/form-data',
        params: {
          title: 'title',
          text: 'text',
          url: 'url',
          files: [
            { name: 'cards', accept: ['text/vcard', 'text/x-vcard', 'text/directory', '.vcf'] },
          ],
        },
      },
      // Long-press the home-screen icon → jump straight to a big scannable QR of
      // your card (our answer to Blinq's lock-screen widget, within PWA limits).
      shortcuts: [
        {
          name: 'Show my card',
          short_name: 'My Card',
          description: 'Pull up a big QR of your card to scan',
          url: '/?card=present',
          icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
        },
        {
          name: 'Scan a card',
          short_name: 'Scan',
          description: 'Capture a new contact',
          url: '/?go=scan',
          icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
        },
      ],
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
      // Put the .html back on extensionless precache entries.
      //
      // vite-pwa strips it because Nitro's node server resolves /offline to
      // offline.html. Vercel does not: it serves static files literally, so the
      // precache list shipped two URLs (/offline, /embed-test) that 404 in
      // production. Workbox precaching is all-or-nothing — one failed request
      // rejects the install event — so the service worker NEVER ACTIVATED on
      // production. No push subscription, no offline cache, and
      // `serviceWorker.ready` hanging forever, which is the "Service worker
      // isn't ready" people were hitting on iPhone.
      //
      // Written as a transform rather than dropping the two files, so the next
      // .html added to public/ can't silently break the worker the same way.
      manifestTransforms: [
        (entries: { url: string }[]) => ({
          manifest: entries.map((entry) =>
            /\.[a-z0-9]+$/i.test(entry.url) || entry.url.endsWith('/')
              ? entry
              : { ...entry, url: `${entry.url}.html` },
          ),
          warnings: [],
        }),
      ],
    },
    devOptions: { enabled: true, type: 'module' },
    client: {
      installPrompt: true,
      // Poll for a new service worker hourly. Long-open PWA sessions navigate
      // client-side only, so the browser may not re-check for a new SW for a
      // long time on its own; this calls registration.update() on an interval
      // so a fresh deploy is discovered and $pwa.needRefresh flips to true.
      periodicSyncForUpdates: 3600,
    },
  },
  // The embed surfaces are meant to be iframed onto third-party sites. CardDesk
  // sends no X-Frame-Options by default, but set frame-ancestors explicitly so
  // framing is allowed-by-intent (and survives any future global CSP).
  routeRules: {
    // The four "am I current?" oracles. If an edge or a browser cache holds any
    // of these, a client can never learn that it is stale — which is exactly the
    // failure mode this whole system exists to prevent.
    '/_nuxt/builds/latest.json': { headers: { 'cache-control': 'no-cache, no-store, max-age=0, must-revalidate' } },
    '/api/version': { headers: { 'cache-control': 'no-cache, no-store, max-age=0, must-revalidate' } },
    '/sw.js': { headers: { 'cache-control': 'no-cache, no-store, max-age=0, must-revalidate' } },
    '/manifest.webmanifest': { headers: { 'cache-control': 'no-cache, no-store, max-age=0, must-revalidate' } },
    '/embed/**': { headers: { 'Content-Security-Policy': 'frame-ancestors *' } },
    '/embed.js': { headers: { 'Content-Security-Policy': 'frame-ancestors *', 'Cache-Control': 'public, max-age=3600' } },
  },
  css: ['~/assets/css/tailwind.css', '~/assets/css/fonts.css', '~/assets/css/carddesk.css', '~/assets/css/auth.css'],
  vite: {
    plugins: [
      (await import('@tailwindcss/vite')).default(),
    ],
  },
  runtimeConfig: {
    directusStaticToken: process.env.DIRECTUS_STATIC_TOKEN,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:hello@earnest.guru',
    cronSecret: process.env.CRON_SECRET || '',
    stripeSecretKeyTest: process.env.STRIPE_SECRET_KEY_TEST || '',
    stripeSecretKeyLive: process.env.STRIPE_SECRET_KEY_LIVE || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'hello@earnest.guru',
    sendgridFromName: process.env.SENDGRID_FROM_NAME || 'CardDesk',
    sendgridReplyToEmail: process.env.SENDGRID_REPLY_TO_EMAIL || '',
    sendgridBccEmail: process.env.SENDGRID_BCC_EMAIL || '',
    // Google Places/Geocoding — powers location + nearby-venue suggestions on the
    // Add Contact screen. Server-side only (never exposed). Leave unset to disable
    // the whole feature (no key → no calls → no billing).
    googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
    // nuxt-auth-utils session cookie. Without an explicit maxAge the sealed
    // session is a browser-session cookie — dropped when the browser/PWA fully
    // closes, which read as a surprise logout.
    //
    // maxAge is the ABSOLUTE window. h3 anchors expiry to the session's
    // createdAt and never moves it on update, so on its own this is a fixed
    // window from login (force-logout N days after login regardless of use).
    // server/utils/auth.ts → getValidToken resets createdAt (throttled to
    // once/day) on authenticated requests, making this a *sliding* 30-day
    // window: an actively-used app effectively never logs you out; ~30 days of
    // real inactivity ends it. (Directus's refresh-token TTL is the other cap —
    // an expired refresh is handled gracefully: re-login only on explicit
    // token rejection.)
    session: {
      maxAge: 60 * 60 * 24 * 30,
      cookie: { sameSite: 'lax' },
    },
    public: {
      directusUrl: process.env.DIRECTUS_URL || 'http://localhost:8055',
      websocketUrl: process.env.DIRECTUS_WEBSOCKET_URL || 'ws://localhost:8055/websocket',
      directusRoleUser: process.env.NUXT_PUBLIC_DIRECTUS_ROLE_USER || '',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      // Earnest app for pipeline graduation hand-offs (deep-links + sign-up nudge).
      earnestAppUrl: process.env.EARNEST_APP_URL || 'https://app.earnest.guru',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
      // Resolved test/live to mirror the secret key selection (NODE_ENV).
      stripePublishableKey: process.env.NODE_ENV === 'production'
        ? (process.env.STRIPE_PUBLIC_KEY_LIVE || '')
        : (process.env.STRIPE_PUBLIC_KEY_TEST || ''),
      // Whether to show the location/venue suggestion UI. On only when a Places
      // key is configured and it hasn't been explicitly turned off — the simple
      // "don't want to pay" switch (unset the key, or set LOCATION_SUGGEST=false).
      locationSuggest: !!process.env.GOOGLE_PLACES_API_KEY && process.env.LOCATION_SUGGEST !== 'false',
      // Git-traceable release stamp (see releaseStamp() above). Cosmetic +
      // diagnostic; app.buildId drives the actual update handshake.
      release: releaseStamp(),
    },
  },
  typescript: { strict: true },
})
