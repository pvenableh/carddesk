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
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  background: var(--cd-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.auth-container {
  width: 100%;
  max-width: 360px;
}
.auth-logo {
  text-align: center;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 3rem;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}
.auth-tagline {
  text-align: center;
  color: var(--cd-dim);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin: 0 0 40px;
}
</style>
