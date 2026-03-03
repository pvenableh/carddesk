<script setup lang="ts">
const { loggedIn } = useUserSession()
const { loadXp } = useXp()
const { fetchContacts } = useContacts()
watch(loggedIn, async (val) => {
  if (val) await Promise.all([loadXp(), fetchContacts()])
}, { immediate: true })
</script>
<template>
  <div><NuxtRouteAnnouncer /><NuxtPage /></div>
</template>
