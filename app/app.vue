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

onMounted(() => {
  initTheme()
  initPalette()
})

watch(loggedIn, async (val) => {
  if (val) {
    await Promise.all([loadXp(), fetchContacts(), loadProfile(), loadCredits()])
    // Grant any earn-as-you-go rewards already earned (streak, level, etc.).
    claimRewards()
  }
}, { immediate: true })
</script>
<template>
  <div><NuxtRouteAnnouncer /><NuxtPage /><BuyCreditsModal /><CreditRewardToast /><CdFeedbackSheet /><GlassToast /><AppUpdateToast /></div>
</template>
