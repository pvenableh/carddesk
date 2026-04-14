<script setup lang="ts">
import { INDUSTRIES } from '~/composables/useConstants'

definePageMeta({ middleware: 'auth' })

const { user } = useUserSession()
const { logout } = useAuth()
const { theme, isDark, setTheme, toggleDarkMode, THEMES } = useTheme()
const { profile, loading: profileLoading, saved: profileSaved, loadProfile, saveProfile, fullName, company } = useProfile()

const email = computed(() => (user.value?.email as string) ?? '')
const initial = computed(() => {
  const name = fullName.value
  if (name) return name.charAt(0).toUpperCase()
  return email.value.charAt(0).toUpperCase() || '?'
})

const profileForm = ref({ first_name: '', last_name: '', title: '', industry: '', networking_goal: '' })

watch(profile, (p) => {
  profileForm.value = {
    first_name: p.first_name ?? '',
    last_name: p.last_name ?? '',
    title: p.title ?? '',
    industry: p.industry ?? '',
    networking_goal: p.networking_goal ?? '',
  }
}, { immediate: true })

const { contacts } = useContacts()

// Earnest Score
const earnestScore = ref<{ total_score: number; label: string; dimensions: Record<string, number> } | null>(null)

onMounted(async () => {
  loadProfile()
  try {
    const score = await $fetch<any>('/api/earnest-score')
    if (score) earnestScore.value = score
  } catch { /* score not available */ }
})

function doSaveProfile() {
  saveProfile(profileForm.value)
}

const goalLoading = ref(false)
async function suggestGoal() {
  goalLoading.value = true
  try {
    const data = await $fetch<{ goal: string }>('/api/ai-goal', {
      method: 'POST',
      body: {
        contactCount: contacts.value.length,
        clientCount: contacts.value.filter((c: any) => c.is_client).length,
      },
    })
    if (data.goal) profileForm.value.networking_goal = data.goal
  } catch (err: any) {
    console.error('[account] AI goal suggestion failed:', err)
  } finally {
    goalLoading.value = false
  }
}
</script>

<template>
  <div class="acct-page">
    <div class="acct-container">
      <NuxtLink to="/" class="acct-back">← Back</NuxtLink>

      <div class="acct-hero">
        <div class="acct-avatar">{{ initial }}</div>
        <div v-if="fullName" style="font-size: 16px; font-weight: 800; margin-bottom: 2px">{{ fullName }}</div>
        <div class="acct-email">{{ email }}</div>
        <div v-if="company" style="font-size: 12px; color: var(--cd-dim); margin-top: 2px">{{ company }}</div>
      </div>

      <div class="acct-section">
        <div class="acct-section-title">Your Profile</div>
        <div class="acct-profile-form">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">
            <div>
              <label class="acct-field-label">First Name</label>
              <input v-model="profileForm.first_name" class="acct-field-input" placeholder="Jane" />
            </div>
            <div>
              <label class="acct-field-label">Last Name</label>
              <input v-model="profileForm.last_name" class="acct-field-input" placeholder="Smith" />
            </div>
          </div>
          <label class="acct-field-label">Title / Role</label>
          <input v-model="profileForm.title" class="acct-field-input" placeholder="VP Sales" />
          <div v-if="profile.organization?.name" style="margin-top: 4px">
            <label class="acct-field-label">Organization</label>
            <div style="padding: 10px 12px; border-radius: 10px; border: 1px solid var(--cd-bdr); background: var(--cd-bg2); color: var(--cd-muted); font-size: 14px">
              {{ profile.organization.name }}
              <span v-if="profile.organization.industry" style="color: var(--cd-dim); font-size: 12px"> · {{ profile.organization.industry }}</span>
            </div>
          </div>
          <label class="acct-field-label">Industry</label>
          <select v-model="profileForm.industry" class="acct-field-input" style="cursor: pointer">
            <option value="">Select...</option>
            <option v-for="ind in INDUSTRIES" :key="ind" :value="ind">{{ ind }}</option>
          </select>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <label class="acct-field-label">Networking Goal</label>
            <button
              class="acct-ai-btn"
              :disabled="goalLoading"
              @click="suggestGoal"
            >
              {{ goalLoading ? 'Thinking...' : 'AI Suggest' }}
            </button>
          </div>
          <textarea
            v-model="profileForm.networking_goal"
            class="acct-field-input"
            style="min-height: 80px; resize: vertical"
            placeholder="What are you trying to achieve with your network?"
          ></textarea>
          <button class="acct-save-btn" @click="doSaveProfile">
            {{ profileSaved ? 'Saved!' : 'Save Profile' }}
          </button>
        </div>
      </div>

      <!-- Earnest Score -->
      <div v-if="earnestScore" class="acct-section">
        <div class="acct-section-title">Earnest Score</div>
        <div style="background: var(--cd-bg2); border: 1.5px solid var(--cd-bdr); border-radius: 12px; padding: 14px">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px">
            <div style="font-size: 32px; font-weight: 800; color: var(--cd-accent)">{{ earnestScore.total_score }}</div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: var(--cd-text)">{{ earnestScore.label }}</div>
              <div style="font-size: 11px; color: var(--cd-muted)">Your CRM activity in CardDesk contributes to this score</div>
            </div>
          </div>
          <div v-if="earnestScore.dimensions" style="display: flex; flex-direction: column; gap: 4px">
            <div v-for="(value, key) in earnestScore.dimensions" :key="key" style="display: flex; align-items: center; gap: 8px">
              <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--cd-dim); width: 80px; flex-shrink: 0">{{ key }}</span>
              <div style="flex: 1; height: 4px; background: var(--cd-bdr); border-radius: 2px; overflow: hidden">
                <div style="height: 100%; background: var(--cd-accent); border-radius: 2px" :style="'width:' + Math.min(100, (value / 20) * 100) + '%'"></div>
              </div>
              <span style="font-size: 10px; font-weight: 700; color: var(--cd-muted); width: 24px; text-align: right">{{ value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="acct-section">
        <div class="acct-section-title">Theme</div>
        <div class="acct-theme-list">
          <button
            v-for="t in THEMES"
            :key="t.id"
            class="acct-theme-card"
            :class="{ active: theme === t.id }"
            @click="setTheme(t.id)"
          >
            <div class="acct-theme-preview" :class="t.id" />
            <div class="acct-theme-info">
              <span class="acct-theme-name">{{ t.label }}</span>
              <span class="acct-theme-desc">{{ t.description }}</span>
            </div>
            <span class="acct-theme-check">{{ theme === t.id ? '✓' : '' }}</span>
          </button>
        </div>
      </div>

      <div class="acct-section">
        <div class="acct-dm-row">
          <div>
            <div class="acct-dm-label">Dark Mode</div>
            <div class="acct-dm-desc">{{ isDark ? 'On' : 'Off' }}</div>
          </div>
          <UiDarkModeToggle />
        </div>
      </div>

      <div class="acct-section">
        <button class="acct-logout" @click="logout">
          Log Out
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.acct-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Barlow', sans-serif;
  padding: calc(env(safe-area-inset-top, 16px) + 16px) 16px 32px;
}
.acct-container {
  max-width: 400px;
  margin: 0 auto;
}
.acct-back {
  display: inline-block;
  font-size: 13px;
  font-weight: 700;
  color: var(--cd-dim);
  text-decoration: none;
  margin-bottom: 24px;
  cursor: pointer;
}
.acct-back:hover {
  color: var(--cd-text);
}
.acct-hero {
  text-align: center;
  margin-bottom: 32px;
}
.acct-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--cd-bg2);
  border: 2px solid var(--cd-bdr);
  color: var(--cd-text);
  font-size: 26px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.acct-email {
  font-size: 14px;
  color: var(--cd-muted);
  font-weight: 600;
}
.acct-section {
  margin-bottom: 24px;
}
.acct-section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--cd-dim);
  margin-bottom: 10px;
}
.acct-theme-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.acct-theme-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-bdr);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
  text-align: left;
  color: var(--cd-text);
  font-family: inherit;
}
.acct-theme-card:hover {
  border-color: var(--cd-dim);
}
.acct-theme-card.active {
  border-color: var(--cd-accent);
}
.acct-theme-preview {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
}
.acct-theme-preview.sleeper {
  background: linear-gradient(135deg, #060810, #0d1018);
  border: 1px solid #1c2330;
}
.acct-theme-preview.glass {
  background: linear-gradient(135deg, #ffffff, #fcfcfc);
  border: 1px solid #ebebeb;
}
.acct-theme-info {
  flex: 1;
}
.acct-theme-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.acct-theme-desc {
  display: block;
  font-size: 11px;
  color: var(--cd-dim);
}
.acct-theme-check {
  font-size: 14px;
  color: var(--cd-accent);
  font-weight: 700;
  width: 20px;
  text-align: center;
}
.acct-dm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-bdr);
  border-radius: 12px;
}
.acct-dm-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--cd-text);
}
.acct-dm-desc {
  font-size: 11px;
  color: var(--cd-dim);
}
.acct-logout {
  width: 100%;
  padding: 13px;
  border-radius: 12px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.06);
  color: #f87171;
  font-size: 14px;
  font-weight: 700;
  font-family: sans-serif;
  cursor: pointer;
  transition: background 0.15s;
}
.acct-logout:hover {
  background: rgba(248, 113, 113, 0.12);
}
.acct-profile-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.acct-field-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--cd-dim);
  margin-top: 4px;
  margin-bottom: 2px;
}
.acct-field-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg2);
  color: var(--cd-text);
  font-size: 14px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}
.acct-field-input:focus {
  border-color: var(--cd-accent);
}
.acct-save-btn {
  margin-top: 8px;
  width: 100%;
  padding: 11px;
  border-radius: 10px;
  border: none;
  background: var(--cd-accent);
  color: #000;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
}
.acct-save-btn:hover {
  opacity: 0.85;
}
.acct-ai-btn {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--cd-bdr);
  background: transparent;
  color: var(--cd-accent);
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
.acct-ai-btn:hover {
  opacity: 0.8;
}
.acct-ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
