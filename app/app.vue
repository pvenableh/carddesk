<script setup lang="ts">
// Force baseline title at the topmost component so it survives the
// auth-middleware SSR redirect that otherwise drops nuxt.config's
// app.head.title before Unhead serializes the response.
useHead({ title: 'CardDesk' })

const { loggedIn } = useUserSession()
const { loadXp } = useXp()
const { fetchContacts } = useContacts()
const { loadProfile } = useProfile()
const { loadCredits, claimRewards } = useCredits()
const { init: initTheme } = useTheme()
const { init: initPalette } = useCdPalette()

// The OS app-icon badge, now backed by something real: the count of unread rows
// in the notification inbox. The service worker still raises it optimistically
// when a push lands with no page open; foregrounding corrects it to the truth
// rather than blanket-clearing it, so a nudge you haven't opened keeps its badge.
const { unread: unreadNotifications, load: loadNotifications } = useNotifications()
useAppBadge(unreadNotifications)

onMounted(() => {
  initTheme()
  initPalette()

  // Two ways the inbox goes stale under an app that never reloads: a push
  // arrives while it's open (the worker tells us), or it was backgrounded while
  // something happened (foregrounding is the only signal we get).
  const refresh = () => { if (loggedIn.value) loadNotifications(true) }
  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent) => {
    if (event.data?.type === 'cd-notification') refresh()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })
})

watch(loggedIn, async (val) => {
  if (val) {
    await Promise.all([loadXp(), fetchContacts(), loadProfile(), loadCredits(), loadNotifications()])
    // Grant any earn-as-you-go rewards already earned (streak, level, etc.).
    claimRewards()
  }
}, { immediate: true })
</script>
<template>
  <div><NuxtRouteAnnouncer /><NuxtPage /><BuyCreditsModal /><CreditRewardToast /><CdFeedbackSheet /><GlassToast /><AppUpdateToast /></div>
</template>
