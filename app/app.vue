<script setup lang="ts">
const { loggedIn } = useUserSession()
const { loadXp } = useXp()
const { fetchContacts } = useContacts()
const { loadProfile } = useProfile()
const { init: initTheme } = useTheme()

onMounted(() => {
  initTheme()
})

watch(loggedIn, async (val) => {
  if (val) await Promise.all([loadXp(), fetchContacts(), loadProfile()])
}, { immediate: true })
</script>
<template>
  <div><NuxtRouteAnnouncer /><NuxtPage /></div>
</template>
