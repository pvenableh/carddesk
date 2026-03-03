<script setup lang="ts">
definePageMeta({ layout: false })
const router = useRouter()
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-logo">
        CARD<span style="color: #00ff87">DESK</span>
      </div>
      <p class="auth-tagline">Your network. Gamified.</p>
      <RegisterForm @login="router.push('/login')" />
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
