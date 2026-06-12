<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Log In · CardDesk',
  description: 'Log in to CardDesk — your gamified networking CRM. Scan cards, earn XP, and turn contacts into relationships.',
})

const { login, loading, error } = useAuth()
const route = useRoute()
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
// Bounced here from the signup form because the email already has an account.
const existsNotice = ref(route.query.exists === '1')
async function handleSubmit() {
  if (!email.value || !password.value) return
  await login(email.value, password.value)
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-logo">
        <span style="color: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%)))">CARD</span><span style="color: var(--cd-accent)">DESK</span>
      </div>
      <p class="auth-tagline">Your network. Gamified.</p>
      <div class="auth-card">
        <h1 class="auth-title">Welcome back</h1>
        <p class="auth-subtitle">Sign in to your account</p>
        <div v-if="existsNotice && !error" class="auth-notice">
          You already have an account — sign in to finish connecting.
        </div>
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
    <CdBrandFooter />
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  background: var(--cd-bg);
  display: flex;
  flex-direction: column;
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
.auth-notice {
  margin-bottom: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--cd-accent) 35%, transparent);
  color: var(--cd-text, inherit);
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
}
</style>
