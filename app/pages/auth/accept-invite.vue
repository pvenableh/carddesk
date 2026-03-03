<script setup lang="ts">
definePageMeta({ layout: false })
const router = useRouter()
const route = useRoute()
const token = computed(() => (route.query.token as string) || '')
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-logo">
        CARD<span style="color: #00ff87">DESK</span>
      </div>
      <p class="auth-tagline">Your network. Gamified.</p>
      <div v-if="!token" class="auth-card" style="text-align: center; padding: 40px 32px">
        <div style="font-size: 48px; margin-bottom: 16px">⚠️</div>
        <h1 class="auth-title">Invalid invitation link</h1>
        <p class="auth-subtitle">This invitation link is invalid or has expired.</p>
        <button class="auth-link" @click="router.push('/login')">
          Go to sign in →
        </button>
      </div>
      <AuthAcceptInviteForm v-else :token="token" @login="router.push('/login')" />
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  background: #060810;
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
  color: #3e4f68;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  margin: 0 0 40px;
}
</style>
