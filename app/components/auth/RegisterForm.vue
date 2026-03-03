<script setup lang="ts">
const emit = defineEmits<{
  login: []
}>()

const { register, loading, error } = useAuth()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const localError = ref<string | null>(null)

const passwordStrength = computed(() => {
  const p = password.value
  if (!p) return { score: 0, label: '', color: '' }
  let score = 0
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['', '#ff6b35', '#ffe033', '#00c268', '#00ff87']
  return { score, label: labels[score], color: colors[score] }
})

async function handleSubmit() {
  localError.value = null
  if (!email.value || !password.value) {
    localError.value = 'Email and password are required'
    return
  }
  if (password.value.length < 8) {
    localError.value = 'Password must be at least 8 characters'
    return
  }
  if (password.value !== confirmPassword.value) {
    localError.value = 'Passwords do not match'
    return
  }
  try {
    await register({
      email: email.value,
      password: password.value,
      first_name: firstName.value || undefined,
      last_name: lastName.value || undefined,
    })
  } catch {
    // error is set by useAuth
  }
}

const displayError = computed(() => localError.value || error.value)
</script>

<template>
  <div class="auth-card">
    <h1 class="auth-title">Create your account</h1>
    <p class="auth-subtitle">Start gamifying your network</p>
    <div v-if="displayError" class="auth-error">{{ displayError }}</div>
    <form class="auth-form" @submit.prevent="handleSubmit">
      <div class="auth-row">
        <div>
          <label class="auth-label">First Name</label>
          <input v-model="firstName" class="auth-input" placeholder="Jane" />
        </div>
        <div>
          <label class="auth-label">Last Name</label>
          <input v-model="lastName" class="auth-input" placeholder="Smith" />
        </div>
      </div>
      <div>
        <label class="auth-label">Email</label>
        <input v-model="email" type="email" class="auth-input" placeholder="you@example.com" required />
      </div>
      <div>
        <label class="auth-label">Password</label>
        <input v-model="password" type="password" class="auth-input" placeholder="••••••••" required />
        <div v-if="password" class="auth-strength">
          <div class="auth-strength-track">
            <div
              class="auth-strength-fill"
              :style="{ width: (passwordStrength.score / 4) * 100 + '%', background: passwordStrength.color }"
            ></div>
          </div>
          <span :style="{ color: passwordStrength.color }">{{ passwordStrength.label }}</span>
        </div>
      </div>
      <div>
        <label class="auth-label">Confirm Password</label>
        <input v-model="confirmPassword" type="password" class="auth-input" placeholder="••••••••" required />
      </div>
      <button type="submit" :disabled="loading" class="auth-btn">
        {{ loading ? 'Creating account...' : 'Create Account →' }}
      </button>
    </form>
    <p class="auth-footer">
      Already have an account?
      <button type="button" class="auth-link" @click="emit('login')">Sign in</button>
    </p>
  </div>
</template>
