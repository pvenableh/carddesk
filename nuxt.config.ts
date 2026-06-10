export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 },
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
    'shadcn-nuxt',
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
    registerType: 'autoUpdate',
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
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
    },
    devOptions: { enabled: true, type: 'module' },
    client: { installPrompt: true },
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
    public: {
      directusUrl: process.env.DIRECTUS_URL || 'http://localhost:8055',
      websocketUrl: process.env.DIRECTUS_WEBSOCKET_URL || 'ws://localhost:8055/websocket',
      directusRoleUser: process.env.NUXT_PUBLIC_DIRECTUS_ROLE_USER || '',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
      // Resolved test/live to mirror the secret key selection (NODE_ENV).
      stripePublishableKey: process.env.NODE_ENV === 'production'
        ? (process.env.STRIPE_PUBLIC_KEY_LIVE || '')
        : (process.env.STRIPE_PUBLIC_KEY_TEST || ''),
    },
  },
  shadcn: { prefix: '', componentDir: './app/components/ui' },
  typescript: { strict: true },
})
