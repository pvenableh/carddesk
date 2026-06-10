<script setup lang="ts">
// Card editing now lives as a tab on the account screen. Keep this route as a
// permanent redirect so existing links/bookmarks (and the header menu) land on
// the Business Card tab.
definePageMeta({ middleware: 'auth' })
await navigateTo('/account?tab=card', { redirectCode: 302 })
</script>

<template>
  <div />
</template>
