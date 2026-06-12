<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Set a New Password · CardDesk',
  description: 'Choose a new password for your CardDesk account.',
  robots: 'noindex, nofollow',
})

const router = useRouter()
const route = useRoute()
const token = computed(() => (route.query.token as string) || '')
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-logo">
        <span style="color: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%)))">CARD</span><span style="color: var(--cd-accent)">DESK</span>
      </div>
      <p class="auth-tagline">Your network. Gamified.</p>
      <div v-if="!token" class="auth-card" style="text-align: center; padding: 40px 32px">
        <div style="font-size: 48px; margin-bottom: 16px">⚠️</div>
        <h1 class="auth-title">Invalid reset link</h1>
        <p class="auth-subtitle">This password reset link is invalid or has expired.</p>
        <button class="auth-link" @click="router.push('/auth/forgot-password')">
          Request a new link →
        </button>
      </div>
      <AuthPasswordResetForm v-else :token="token" @login="router.push('/login')" />
    </div>
    <CdBrandFooter />
  </div>
</template>
