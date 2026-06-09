<script setup lang="ts">
/**
 * Invite landing page (/i/:code). If the visitor is signed in, redeem the
 * invite immediately (creates an accepted connection both ways) and drop them
 * into the app. Otherwise stash the code in a cookie and send them to register;
 * the app shell redeems it on first authenticated load (see pages/index.vue).
 */
const route = useRoute()
const code = computed(() => String(route.params.code || ''))
const { loggedIn } = useAuth()
const { success } = useToast()
const inviteCookie = useCookie<string | null>('cd_invite', { maxAge: 60 * 60 * 24 * 7, path: '/' })

onMounted(async () => {
  if (!code.value) return navigateTo('/')
  if (loggedIn.value) {
    try {
      const { inviter } = await $fetch<{ inviter?: { name?: string } }>('/api/invite/redeem', {
        method: 'POST',
        body: { code: code.value },
      })
      success(`You're connected with ${inviter?.name ?? 'your inviter'} 🤝`)
    } catch { /* already connected / invalid — just continue */ }
    return navigateTo('/')
  }
  // Not signed in yet — remember the invite and route to sign-up.
  inviteCookie.value = code.value
  return navigateTo('/register')
})
</script>

<template>
  <div style="min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: var(--cd-bg, #060810); color: var(--cd-text, #fff); text-align: center; padding: 24px">
    <div style="font-family: 'Bebas Neue', sans-serif; font-size: 34px; letter-spacing: 1px">CardDesk<span style="color: #00ff87">.</span></div>
    <div class="cd-spin" style="font-size: 30px"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="30" /></div>
    <div style="font-size: 13px; opacity: 0.7">Connecting you…</div>
  </div>
</template>
