<script setup lang="ts">
/**
 * Invite landing page (/i/:code). If the visitor is signed in, redeem the
 * invite immediately (creates an accepted connection both ways) and drop them
 * into the app. Otherwise stash the code in a cookie and send them to register;
 * the app shell redeems it on first authenticated load (see pages/index.vue).
 */
useSeoMeta({ title: 'Joining CardDesk…', robots: 'noindex, nofollow' })

const route = useRoute()
const code = computed(() => String(route.params.code || ''))
const { loggedIn } = useAuth()
const { success } = useToast()
const analytics = useAnalytics()
const inviteCookie = useCookie<string | null>('cd_invite', { maxAge: 60 * 60 * 24 * 7, path: '/' })

onMounted(async () => {
  if (!code.value) return navigateTo('/')
  if (loggedIn.value) {
    try {
      const { inviter } = await $fetch<{ inviter?: { name?: string } }>('/api/invite/redeem', {
        method: 'POST',
        body: { code: code.value },
      })
      analytics.inviteRedeem()
      success(`You're connected with ${inviter?.name ?? 'your inviter'} 🤝`)
    } catch { /* already connected / invalid — just continue */ }
    return navigateTo('/')
  }
  // Not signed in yet — remember the invite and route to sign-up.
  inviteCookie.value = code.value
  return navigateTo('/auth/register')
})
</script>

<template>
  <div class="auth-page invite-interstitial">
    <div class="auth-logo">
      <span style="color: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%)))">CARD</span><span style="color: var(--cd-accent)">DESK</span>
    </div>
    <div class="cd-spin" style="font-size: 30px; color: var(--cd-green)"><CdIcon emoji="⏳" icon="lucide:loader-circle" :size="30" /></div>
    <div class="invite-interstitial-note">Connecting you…</div>
  </div>
</template>

<style scoped>
/* Centred over the shared auth aurora. .auth-page/.auth-logo come from auth.css. */
.invite-interstitial { gap: 16px; text-align: center; }
.invite-interstitial .auth-logo { margin-bottom: 0; }
.invite-interstitial-note {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--cd-muted);
}
</style>
