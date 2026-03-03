export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  future: { compatibilityVersion: 4 },
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'theme-color', content: '#060810' },
      ],
    },
  },
  modules: [
    '@nuxtjs/color-mode',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/fonts',
    'nuxt-auth-utils',
    '@vueuse/nuxt',
    'shadcn-nuxt',
  ],
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
  colorMode: { classSuffix: '', defaultValue: 'dark' },
  typescript: { strict: true },
})
