<script setup lang="ts">
definePageMeta({ layout: false })
const { login, loading, error } = useAuth()
const email = ref('')
const password = ref('')
async function handleSubmit() {
  if (!email.value || !password.value) return
  await login(email.value, password.value)
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-logo">
        CARD<span style="color: #00ff87">DESK</span>
      </div>
      <p class="auth-tagline">Your network. Gamified.</p>
      <div class="auth-card">
        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-subtitle">Sign in to your account</p>
        <div v-if="error" class="auth-error">{{ error }}</div>
        <form class="auth-form" @submit.prevent="handleSubmit">
          <div>
            <label class="auth-label">Email</label>
            <input
              v-model="email"
              type="email"
              class="auth-input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <label class="auth-label" style="margin-bottom: 0">Password</label>
              <NuxtLink
                to="/auth/forgot-password"
                class="auth-link"
                style="font-size: 0.7rem"
              >Forgot password?</NuxtLink>
            </div>
            <input
              v-model="password"
              type="password"
              class="auth-input"
              placeholder="••••••••"
              required
              style="margin-top: 8px"
            />
          </div>
          <button type="submit" :disabled="loading" class="auth-btn">
            {{ loading ? 'Signing in...' : 'Sign In →' }}
          </button>
        </form>
        <p class="auth-footer">
          Don't have an account?
          <NuxtLink to="/auth/register" class="auth-link">Create one</NuxtLink>
        </p>
      </div>
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
