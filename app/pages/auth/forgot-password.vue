<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Reset Your Password · CardDesk',
  description: 'Forgot your CardDesk password? Enter your email and we’ll send you a reset link.',
  robots: 'noindex, nofollow',
})

const router = useRouter()
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-logo">
        <span style="color: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%)))">CARD</span><span style="color: var(--cd-accent)">DESK</span>
      </div>
      <p class="auth-tagline">Your network. Gamified.</p>
      <AuthPasswordResetRequestForm @login="router.push('/login')" />
    </div>
    <CdBrandFooter />
  </div>
</template>
