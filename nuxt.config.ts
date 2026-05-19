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
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
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
  ],
  pwa: {
    registerType: 'autoUpdate',
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
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//, /^\/_/],
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
      runtimeCaching: [
        {
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'cd-api',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ request }: { request: Request }) => request.destination === 'font',
          handler: 'CacheFirst',
          options: {
            cacheName: 'cd-fonts',
            expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ request }: { request: Request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'cd-images',
            expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
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
    public: {
      directusUrl: process.env.DIRECTUS_URL || 'http://localhost:8055',
      websocketUrl: process.env.DIRECTUS_WEBSOCKET_URL || 'ws://localhost:8055/websocket',
      directusRoleUser: process.env.NUXT_PUBLIC_DIRECTUS_ROLE_USER || '',
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    },
  },
  shadcn: { prefix: '', componentDir: './app/components/ui' },
  typescript: { strict: true },
})
