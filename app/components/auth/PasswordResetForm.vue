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

const { resetPassword, loading, error } = useAuth()
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
    await resetPassword(props.token, values.password)
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
        <div style="margin-bottom: 16px; line-height: 0; color: var(--cd-green)"><CdIcon icon="lucide:circle-check" :size="48" /></div>
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
      <div v-if="error" class="auth-error">{{ error }}</div>
      <form class="auth-form" novalidate @submit="onSubmit">
        <div>
          <label class="auth-label">New Password</label>
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
          {{ loading ? 'Resetting...' : 'Reset Password →' }}
        </button>
      </form>
      <p class="auth-footer">
        <button type="button" class="auth-link" @click="emit('login')">← Back to sign in</button>
      </p>
    </template>
  </div>
</template>
