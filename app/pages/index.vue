<script setup lang="ts">
import type { Screen } from '~/composables/useNavigation'
import PhoneVibeScreen from '~/components/phone/VibeScreen.vue'
import PhoneSessionScreen from '~/components/phone/SessionScreen.vue'
import PhoneColdScreen from '~/components/phone/ColdScreen.vue'
import PhoneHomeScreen from '~/components/phone/HomeScreen.vue'
import PhoneContactsScreen from '~/components/phone/ContactsScreen.vue'
import PhoneDetailScreen from '~/components/phone/DetailScreen.vue'
import PhoneAddContactScreen from '~/components/phone/AddContactScreen.vue'

// No auth middleware here: logged-out visitors get the marketing landing at the
// bare domain instead of a redirect to /login. The app shell only renders when a
// session exists.
const { loggedIn } = useUserSession()

const { fetchContacts, followUpStatus, contacts } = useContacts()
const { toast, loadXp, earn } = useXp()
const { loadProfile } = useProfile()
const { screen, nav, transitionName } = useNavigation()
const { theme } = useTheme()
const { load: loadConnections } = useConnections()
const analytics = useAnalytics()
// Pending invite stashed by /i/[code] before the user signed up. Redeemed on
// first authenticated load so the new user lands already connected.
const inviteCookie = useCookie<string | null>('cd_invite', { path: '/' })

// ─── Marketing SEO ───
// The logged-out landing at `/` is the public face of the site, so the page
// root owns the marketing meta (title/description/OG/Twitter/canonical).
// Absolute URLs are derived from the actual request host so canonical + share
// images resolve correctly across preview/prod domains.
const seoUrl = useRequestURL()
const siteOrigin = seoUrl.origin
const ogImage = `${siteOrigin}/og-image.png`
const seoTitle = 'CardDesk — Networking, but make it a game'
const seoDescription =
  'Turn the business cards piling up in your pocket into XP, streaks, and real relationships. CardDesk makes meeting people genuinely fun — with Earnest AI doing the heavy lifting. Start free with 25 tokens, no credit card.'
useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  ogType: 'website',
  ogSiteName: 'CardDesk',
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogUrl: `${siteOrigin}/`,
  ogImage,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'CardDesk — turn the cards in your pocket into XP, streaks, and real relationships',
  twitterCard: 'summary_large_image',
  twitterTitle: seoTitle,
  twitterDescription: seoDescription,
  twitterImage: ogImage,
})
useHead({
  link: [{ rel: 'canonical', href: `${siteOrigin}/` }],
})

const rootClass = computed(() => ['cd-root', theme.value === 'glass' ? 'cd-glass' : ''])

const screenComponents: Record<Screen, Component> = {
  vibe: PhoneVibeScreen,
  session: PhoneSessionScreen,
  cold: PhoneColdScreen,
  home: PhoneHomeScreen,
  contacts: PhoneContactsScreen,
  detail: PhoneDetailScreen,
  add: PhoneAddContactScreen,
}

const currentScreen = computed(() => screenComponents[screen.value])

const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)

onMounted(async () => {
  if (!loggedIn.value) return
  await Promise.all([fetchContacts(), loadXp(), loadProfile()])

  // Redeem a pending invite (set by /i/[code] before signup).
  if (inviteCookie.value) {
    const code = inviteCookie.value
    inviteCookie.value = null
    try {
      const { inviter } = await $fetch<{ inviter?: { name?: string } }>('/api/invite/redeem', {
        method: 'POST',
        body: { code },
      })
      analytics.inviteRedeem()
      earn(25, '🎉', `Joined — connected with ${inviter?.name ?? 'your inviter'}!`)
      loadConnections(true)
    } catch { /* invalid/expired/already connected — ignore */ }
  }
})
</script>

<template>
  <CdLanding v-if="!loggedIn" />
  <div v-else :class="rootClass">
    <PhoneHeaderBar />

    <!-- Screens with iOS-like transitions -->
    <div class="cd-screens">
      <Transition :name="transitionName" mode="out-in">
        <KeepAlive>
          <component :is="currentScreen" :key="screen" />
        </KeepAlive>
      </Transition>
    </div>

    <!-- Bottom Nav -->
    <PhoneBottomNav
      :active="screen"
      :alert-count="alertCs.length"
      @nav="nav"
    />

    <!-- XP Toast -->
    <PhoneXpToast :toast="toast" />

    <!-- Global share sheet (My Card / Invite) -->
    <PhoneShareSheet />

    <!-- Scoring cheat-sheet flyout -->
    <PhoneScoreGuide />

    <!-- PWA install prompt — hidden for now -->
    <!-- <CdInstallPrompt /> -->
  </div>
</template>

<style scoped>
.cd-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Barlow', sans-serif;
}
.cd-root.cd-glass {
  font-family: "Proxima Nova", sans-serif;
  letter-spacing: 0.01em;
}
.cd-screens {
  flex: 1;
  overflow: hidden;
  position: relative;
  max-width: 768px;
  margin: 0 auto;
  width: 100%;
}
</style>
