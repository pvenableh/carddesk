<script setup lang="ts">
/**
 * Shared password-strength meter for the auth password-setting forms
 * (register, accept-invite, reset). Renders nothing until a password is typed.
 * Styling lives in assets/css/auth.css (.auth-strength*).
 */
const props = defineProps<{ password?: string }>()

const strength = computed(() => {
  const p = props.password ?? ''
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
</script>

<template>
  <div v-if="password" class="auth-strength">
    <div class="auth-strength-track">
      <div
        class="auth-strength-fill"
        :style="{ width: (strength.score / 4) * 100 + '%', background: strength.color }"
      ></div>
    </div>
    <span :style="{ color: strength.color }">{{ strength.label }}</span>
  </div>
</template>
