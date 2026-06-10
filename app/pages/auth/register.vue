<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Create Your Account · CardDesk',
  description: 'Sign up free for CardDesk and get 25 Earnest AI tokens. Scan business cards, earn XP, and grow real relationships — no credit card needed.',
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
      <AuthRegisterForm @login="router.push('/login')" />
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
