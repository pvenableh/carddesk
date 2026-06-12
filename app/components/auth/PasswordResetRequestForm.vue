<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'

const emit = defineEmits<{
  login: []
}>()

const { requestPasswordReset, loading, error } = useAuth()
const sent = ref(false)
const sentTo = ref('')

const schema = toTypedSchema(
  z.object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  }),
)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: { email: '' },
})
const [email, emailAttrs] = defineField('email')

const onSubmit = handleSubmit(async (values) => {
  try {
    await requestPasswordReset(values.email)
    sentTo.value = values.email
    sent.value = true
  } catch {
    // server-side error is surfaced via useAuth's `error`
  }
})
</script>

<template>
  <div class="auth-card">
    <template v-if="sent">
      <div style="text-align: center; padding: 20px 0">
        <div style="margin-bottom: 16px; color: var(--cd-accent)"><CdIcon emoji="📧" icon="lucide:mail" :size="48" /></div>
        <h1 class="auth-title">Check your email</h1>
        <p class="auth-subtitle" style="margin-bottom: 24px">
          If an account exists for <strong style="color: var(--cd-text)">{{ sentTo }}</strong>,
          you'll receive a password reset link shortly.
        </p>
        <button type="button" class="auth-link" @click="emit('login')">← Back to sign in</button>
      </div>
    </template>
    <template v-else>
      <h1 class="auth-title">Forgot password?</h1>
      <p class="auth-subtitle">Enter your email and we'll send you a reset link</p>
      <div v-if="error" class="auth-error">{{ error }}</div>
      <form class="auth-form" novalidate @submit="onSubmit">
        <div>
          <label class="auth-label">Email</label>
          <input v-model="email" v-bind="emailAttrs" type="email" class="auth-input" placeholder="you@example.com" />
          <span v-if="errors.email" class="auth-field-error">{{ errors.email }}</span>
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
