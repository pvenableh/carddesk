<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { INDUSTRIES } from '~/composables/useConstants'

const emit = defineEmits<{
  login: []
}>()

const { register, loading, error } = useAuth()

// Single source of truth for client-side validation (vee-validate + zod).
const schema = toTypedSchema(
  z
    .object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().min(1, 'Email is required').email('Enter a valid email'),
      industry: z.string().min(1, 'Please select your industry'),
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
  // Start fields as '' (not undefined) so zod's .min() messages show instead of
  // the generic "Required".
  initialValues: { first_name: '', last_name: '', email: '', industry: '', password: '', confirmPassword: '' },
})
const [firstName, firstNameAttrs] = defineField('first_name')
const [lastName, lastNameAttrs] = defineField('last_name')
const [email, emailAttrs] = defineField('email')
const [industry, industryAttrs] = defineField('industry')
const [password, passwordAttrs] = defineField('password')
const [confirmPassword, confirmAttrs] = defineField('confirmPassword')

const passwordStrength = computed(() => {
  const p = password.value ?? ''
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

const onSubmit = handleSubmit(async (values) => {
  try {
    await register({
      email: values.email,
      password: values.password,
      first_name: values.first_name || undefined,
      last_name: values.last_name || undefined,
      industry: values.industry,
    })
  } catch {
    // server-side error is surfaced via useAuth's `error`
  }
})
</script>

<template>
  <div class="auth-card">
    <h1 class="auth-title">Create your account</h1>
    <p class="auth-subtitle">Start gamifying your network</p>
    <div v-if="error" class="auth-error">{{ error }}</div>
    <form class="auth-form" novalidate @submit="onSubmit">
      <div class="auth-row">
        <div>
          <label class="auth-label">First Name</label>
          <input v-model="firstName" v-bind="firstNameAttrs" class="auth-input" placeholder="Jane" />
        </div>
        <div>
          <label class="auth-label">Last Name</label>
          <input v-model="lastName" v-bind="lastNameAttrs" class="auth-input" placeholder="Smith" />
        </div>
      </div>
      <div>
        <label class="auth-label">Email</label>
        <input v-model="email" v-bind="emailAttrs" type="email" class="auth-input" placeholder="you@example.com" />
        <span v-if="errors.email" class="auth-field-error">{{ errors.email }}</span>
      </div>
      <div>
        <label class="auth-label">Industry</label>
        <select v-model="industry" v-bind="industryAttrs" class="auth-input" style="cursor: pointer">
          <option value="" disabled>Select your industry…</option>
          <option v-for="ind in INDUSTRIES" :key="ind" :value="ind">{{ ind }}</option>
        </select>
        <span v-if="errors.industry" class="auth-field-error">{{ errors.industry }}</span>
      </div>
      <div>
        <label class="auth-label">Password</label>
        <input v-model="password" v-bind="passwordAttrs" type="password" class="auth-input" placeholder="••••••••" />
        <div v-if="password" class="auth-strength">
          <div class="auth-strength-track">
            <div
              class="auth-strength-fill"
              :style="{ width: (passwordStrength.score / 4) * 100 + '%', background: passwordStrength.color }"
            ></div>
          </div>
          <span :style="{ color: passwordStrength.color }">{{ passwordStrength.label }}</span>
        </div>
        <span v-if="errors.password" class="auth-field-error">{{ errors.password }}</span>
      </div>
      <div>
        <label class="auth-label">Confirm Password</label>
        <input v-model="confirmPassword" v-bind="confirmAttrs" type="password" class="auth-input" placeholder="••••••••" />
        <span v-if="errors.confirmPassword" class="auth-field-error">{{ errors.confirmPassword }}</span>
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

<style scoped>
.auth-field-error {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #ff6b35;
}
</style>
