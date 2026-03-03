<script setup lang="ts">
const emit = defineEmits<{
  login: []
}>()

const { requestPasswordReset, loading, error } = useAuth()

const email = ref('')
const sent = ref(false)

async function handleSubmit() {
  if (!email.value) return
  try {
    await requestPasswordReset(email.value)
    sent.value = true
  } catch {
    // error is set by useAuth
  }
}
</script>

<template>
  <div class="auth-card">
    <template v-if="sent">
      <div style="text-align: center; padding: 20px 0">
        <div style="font-size: 48px; margin-bottom: 16px">📧</div>
        <h1 class="auth-title">Check your email</h1>
        <p class="auth-subtitle" style="margin-bottom: 24px">
          If an account exists for <strong style="color: #f0f4ff">{{ email }}</strong>,
          you'll receive a password reset link shortly.
        </p>
        <button type="button" class="auth-link" @click="emit('login')">← Back to sign in</button>
      </div>
    </template>
    <template v-else>
      <h1 class="auth-title">Forgot password?</h1>
      <p class="auth-subtitle">Enter your email and we'll send you a reset link</p>
      <div v-if="error" class="auth-error">{{ error }}</div>
      <form class="auth-form" @submit.prevent="handleSubmit">
        <div>
          <label class="auth-label">Email</label>
          <input v-model="email" type="email" class="auth-input" placeholder="you@example.com" required />
        </div>
        <button type="submit" :disabled="loading" class="auth-btn">
          {{ loading ? 'Sending...' : 'Send Reset Link →' }}
        </button>
      </form>
      <p class="auth-footer">
        Remember your password?
        <button type="button" class="auth-link" @click="emit('login')">Sign in</button>
      </p>
    </template>
  </div>
</template>
