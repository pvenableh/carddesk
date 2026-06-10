<script setup lang="ts">
import type { Screen } from '~/composables/useNavigation'
import PhoneVibeScreen from '~/components/phone/VibeScreen.vue'
import PhoneSessionScreen from '~/components/phone/SessionScreen.vue'
import PhoneColdScreen from '~/components/phone/ColdScreen.vue'
import PhoneHomeScreen from '~/components/phone/HomeScreen.vue'
import PhoneContactsScreen from '~/components/phone/ContactsScreen.vue'
import PhoneDetailScreen from '~/components/phone/DetailScreen.vue'
import PhoneAddContactScreen from '~/components/phone/AddContactScreen.vue'
import PhoneEventModeScreen from '~/components/phone/EventModeScreen.vue'
import PhoneFeedScreen from '~/components/phone/FeedScreen.vue'
import PhoneChatScreen from '~/components/phone/ChatScreen.vue'

// No auth middleware here: logged-out visitors get the marketing landing at the
// bare domain instead of a redirect to /login. The app shell only renders when a
// session exists.
const { loggedIn } = useUserSession()

const { fetchContacts, followUpStatus, contacts } = useContacts()
const { toast, loadXp, earn } = useXp()
const { loadProfile } = useProfile()
const { screen, nav, transitionName } = useNavigation()
const { isOpen: chatOpen } = useChat()
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
  event: PhoneEventModeScreen,
  feed: PhoneFeedScreen,
  chat: PhoneChatScreen,
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

    <!-- Floating Ask Earnest button (context-aware per screen) -->
    <PhoneAskEarnestFab />

    <!-- Ask Earnest panel — slides up over the page; close slides it back down -->
    <Transition name="cd-chatsheet">
      <div v-if="chatOpen" class="cd-chat-sheet">
        <PhoneChatScreen />
      </div>
    </Transition>

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
  position: relative;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Barlow', sans-serif;
}
.cd-root.cd-glass {
  font-family: "Proxima Nova", sans-serif;
  letter-spacing: 0.01em;
}
/* Full-width so the empty space on either side of the centred content column is
   still part of the scroll surface — on iPad, dragging in the gutter scrolls the
   screen content instead of rubber-banding the page. Content stays centred via
   the responsive --cd-gutter padding on .cd-scrl / .cd-shdr / .cd-save-bar. */
.cd-screens {
  flex: 1;
  overflow: hidden;
  position: relative;
  width: 100%;
}
/* Ask Earnest panel: a full-height sheet that covers the app shell. It owns the
   top safe-area inset (it sits above the header bar) and the ChatScreen inside
   handles the bottom composer inset. */
.cd-chat-sheet {
  position: absolute;
  inset: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  background: var(--cd-bg);
  padding-top: env(safe-area-inset-top, 0px);
}
/* Slide up on enter, slide back down on leave. */
.cd-chatsheet-enter-active,
.cd-chatsheet-leave-active {
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}
.cd-chatsheet-enter-from,
.cd-chatsheet-leave-to {
  transform: translateY(100%);
}
</style>
