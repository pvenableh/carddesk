<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

const props = defineProps<{
  token: string
}>()

const emit = defineEmits<{
  login: []
}>()

const { acceptInvite, loading, error } = useAuth()
const success = ref(false)

// Same client-side validation contract as the sign-up form (vee-validate + zod).
const schema = toTypedSchema(
  z
    .object({
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string().min(1, 'Please confirm your password'),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    }),
)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: { password: '', confirmPassword: '' },
})
const [password, passwordAttrs] = defineField('password')
const [confirmPassword, confirmAttrs] = defineField('confirmPassword')

const onSubmit = handleSubmit(async (values) => {
  try {
    await acceptInvite(props.token, values.password)
    success.value = true
  } catch {
    // server-side error is surfaced via useAuth's `error`
  }
})
</script>

<template>
  <div class="auth-card">
    <template v-if="success">
      <div style="text-align: center; padding: 20px 0">
        <div style="margin-bottom: 16px; line-height: 0; color: var(--cd-green)"><CdIcon icon="lucide:party-popper" :size="48" /></div>
        <h1 class="auth-title">You're in!</h1>
        <p class="auth-subtitle" style="margin-bottom: 24px">
          Your account is ready. Sign in to get started.
        </p>
        <button type="button" class="auth-btn" style="max-width: 240px; margin: 0 auto" @click="emit('login')">
          Sign In →
        </button>
      </div>
    </template>
    <template v-else>
      <!-- Floating glass chips — the gamified hero pills from the landing -->
      <div class="auth-chips" aria-hidden="true">
        <span class="auth-chip auth-chip-xp">+50 XP</span>
        <span class="auth-chip auth-chip-streak"><CdIcon emoji="🔥" icon="lucide:flame" :size="13" /> day 1</span>
      </div>
      <h1 class="auth-title">Accept invitation</h1>
      <p class="auth-subtitle">Set your password to complete your account</p>
      <div class="auth-token-badge">
        <CdIcon emoji="✨" icon="lucide:sparkles" :size="15" />
        <span><strong>25 Earnest AI tokens</strong> are waiting for you</span>
      </div>
      <div v-if="error" class="auth-error">{{ error }}</div>
      <form class="auth-form" novalidate @submit="onSubmit">
        <div>
          <label class="auth-label">Password</label>
          <input v-model="password" v-bind="passwordAttrs" type="password" class="auth-input" placeholder="••••••••" />
          <AuthPasswordStrength :password="password" />
          <span v-if="errors.password" class="auth-field-error">{{ errors.password }}</span>
        </div>
        <div>
          <label class="auth-label">Confirm Password</label>
          <input v-model="confirmPassword" v-bind="confirmAttrs" type="password" class="auth-input" placeholder="••••••••" />
          <span v-if="errors.confirmPassword" class="auth-field-error">{{ errors.confirmPassword }}</span>
        </div>
        <button type="submit" :disabled="loading" class="auth-btn">
          {{ loading ? 'Setting up...' : 'Complete Setup →' }}
        </button>
        <p class="auth-hand">your network's about to get a whole lot more fun ✨</p>
      </form>
      <p class="auth-footer">
        Already have an account?
        <button type="button" class="auth-link" @click="emit('login')">Sign in</button>
      </p>
    </template>
  </div>
</template>
