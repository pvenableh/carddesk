<script setup lang="ts">
// Force baseline title at the topmost component so it survives the
// auth-middleware SSR redirect that otherwise drops nuxt.config's
// app.head.title before Unhead serializes the response.
useHead({ title: 'CardDesk' })

const { loggedIn } = useUserSession()
const { loadXp } = useXp()
const { fetchContacts } = useContacts()
const { loadProfile } = useProfile()
const { init: initTheme } = useTheme()
const { init: initPalette } = useCdPalette()

onMounted(() => {
  initTheme()
  initPalette()
})

watch(loggedIn, async (val) => {
  if (val) await Promise.all([loadXp(), fetchContacts(), loadProfile()])
}, { immediate: true })
</script>
<template>
  <div><NuxtRouteAnnouncer /><NuxtPage /></div>
</template>
