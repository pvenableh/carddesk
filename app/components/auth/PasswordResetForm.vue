<script setup lang="ts">
const props = defineProps<{
  token: string
}>()

const emit = defineEmits<{
  login: []
}>()

const { resetPassword, loading, error } = useAuth()

const password = ref('')
const confirmPassword = ref('')
const localError = ref<string | null>(null)
const success = ref(false)

async function handleSubmit() {
  localError.value = null
  if (password.value.length < 8) {
    localError.value = 'Password must be at least 8 characters'
    return
  }
  if (password.value !== confirmPassword.value) {
    localError.value = 'Passwords do not match'
    return
  }
  try {
    await resetPassword(props.token, password.value)
    success.value = true
  } catch {
    // error is set by useAuth
  }
}

const displayError = computed(() => localError.value || error.value)
</script>

<template>
  <div class="auth-card">
    <template v-if="success">
      <div style="text-align: center; padding: 20px 0">
        <div style="font-size: 48px; margin-bottom: 16px">✅</div>
        <h1 class="auth-title">Password updated</h1>
        <p class="auth-subtitle" style="margin-bottom: 24px">
          Your password has been reset successfully.
        </p>
        <button type="button" class="auth-btn" style="max-width: 240px; margin: 0 auto" @click="emit('login')">
          Sign In →
        </button>
      </div>
    </template>
    <template v-else>
      <h1 class="auth-title">Set new password</h1>
      <p class="auth-subtitle">Enter your new password below</p>
      <div v-if="displayError" class="auth-error">{{ displayError }}</div>
      <form class="auth-form" @submit.prevent="handleSubmit">
        <div>
          <label class="auth-label">New Password</label>
          <input v-model="password" type="password" class="auth-input" placeholder="••••••••" required />
        </div>
        <div>
          <label class="auth-label">Confirm Password</label>
          <input v-model="confirmPassword" type="password" class="auth-input" placeholder="••••••••" required />
        </div>
        <button type="submit" :disabled="loading" class="auth-btn">
          {{ loading ? 'Resetting...' : 'Reset Password →' }}
        </button>
      </form>
      <p class="auth-footer">
        <button type="button" class="auth-link" @click="emit('login')">← Back to sign in</button>
      </p>
    </template>
  </div>
</template>
