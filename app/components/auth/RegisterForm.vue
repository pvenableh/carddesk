<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { INDUSTRIES } from '~/composables/useConstants'

defineProps<{
  // When the visitor arrived via an invite link, the name of who invited them —
  // shown as a personalized "X invited you" banner above the form.
  inviterName?: string | null
}>()

const emit = defineEmits<{
  login: []
}>()

const { register, loading, error } = useAuth()

// Single source of truth for client-side validation (vee-validate + zod).
const schema = toTypedSchema(
  z
    .object({
      first_name: z.string().min(1, 'First name is required'),
      last_name: z.string().min(1, 'Last name is required'),
      title: z.string().optional(),
      email: z.string().min(1, 'Email is required').email('Enter a valid email'),
      industry: z.string().min(1, 'Please select your industry'),
      location: z.string().optional(),
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
  initialValues: { first_name: '', last_name: '', title: '', email: '', industry: '', location: '', password: '', confirmPassword: '' },
})
const [firstName, firstNameAttrs] = defineField('first_name')
const [lastName, lastNameAttrs] = defineField('last_name')
const [title, titleAttrs] = defineField('title')
const [email, emailAttrs] = defineField('email')
const [industry, industryAttrs] = defineField('industry')
const [location, locationAttrs] = defineField('location')
const [password, passwordAttrs] = defineField('password')
const [confirmPassword, confirmAttrs] = defineField('confirmPassword')

const onSubmit = handleSubmit(async (values) => {
  try {
    await register({
      email: values.email,
      password: values.password,
      first_name: values.first_name,
      last_name: values.last_name,
      title: values.title || undefined,
      industry: values.industry,
      location: values.location || undefined,
    })
  } catch {
    // server-side error is surfaced via useAuth's `error`
  }
})
</script>

<template>
  <div class="auth-card">
    <!-- Floating glass chips — the gamified hero pills from the landing -->
    <div class="auth-chips" aria-hidden="true">
      <span class="auth-chip auth-chip-xp">+50 XP</span>
      <span class="auth-chip auth-chip-streak"><CdIcon emoji="🔥" icon="lucide:flame" :size="13" /> day 1</span>
    </div>
    <h1 class="auth-title">Create your account</h1>
    <p class="auth-subtitle">Start gamifying your network</p>
    <div v-if="inviterName" class="auth-invite-banner">
      <CdIcon emoji="🤝" icon="lucide:handshake" :size="16" />
      <span><strong>{{ inviterName }}</strong> invited you — sign up to connect</span>
    </div>
    <div class="auth-token-badge">
      <CdIcon emoji="✨" icon="lucide:sparkles" :size="15" />
      <span><strong>25 Earnest AI tokens</strong> free when you start</span>
    </div>
    <div v-if="error" class="auth-error">{{ error }}</div>
    <form class="auth-form" novalidate @submit="onSubmit">
      <div class="auth-row">
        <div>
          <label class="auth-label">First Name</label>
          <input v-model="firstName" v-bind="firstNameAttrs" class="auth-input" placeholder="Jane" />
          <span v-if="errors.first_name" class="auth-field-error">{{ errors.first_name }}</span>
        </div>
        <div>
          <label class="auth-label">Last Name</label>
          <input v-model="lastName" v-bind="lastNameAttrs" class="auth-input" placeholder="Smith" />
          <span v-if="errors.last_name" class="auth-field-error">{{ errors.last_name }}</span>
        </div>
      </div>
      <div>
        <label class="auth-label">Title</label>
        <input v-model="title" v-bind="titleAttrs" class="auth-input" placeholder="Founder, Designer, etc." />
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
        <label class="auth-label">Location</label>
        <input v-model="location" v-bind="locationAttrs" class="auth-input" placeholder="New York, NY" />
      </div>
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
        {{ loading ? 'Creating account...' : 'Create Account →' }}
      </button>
      <p class="auth-hand">no credit card — your first 25 tokens are on us ✨</p>
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
