<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Create Your Account · CardDesk',
  description: 'Sign up free for CardDesk and get 25 Earnest AI tokens. Scan business cards, earn XP, and grow real relationships — no credit card needed.',
})

const router = useRouter()

// If the visitor arrived via an invite link (/i/:code stashed the code before
// routing here), greet them by their inviter's name. Read-only preview — the
// connection itself is redeemed after sign-up (see pages/index.vue).
const inviteCookie = useCookie<string | null>('cd_invite', { path: '/' })
const inviterName = ref<string | null>(null)
onMounted(async () => {
  if (!inviteCookie.value) return
  try {
    const { inviter } = await $fetch<{ inviter?: { name?: string } }>(`/api/invite/${inviteCookie.value}`)
    if (inviter?.name) inviterName.value = inviter.name
  } catch { /* unknown/expired code — fall back to the generic copy */ }
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-logo">
        <span style="color: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%)))">CARD</span><span style="color: var(--cd-accent)">DESK</span>
      </div>
      <p class="auth-tagline">Your network. Gamified.</p>
      <AuthRegisterForm :inviter-name="inviterName" @login="router.push('/login')" />
    </div>
    <CdBrandFooter />
  </div>
</template>
