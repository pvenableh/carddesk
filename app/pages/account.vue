<script setup lang="ts">
import { INDUSTRIES } from '~/composables/useConstants'

definePageMeta({ middleware: 'auth' })

const { user } = useUserSession()
const { logout } = useAuth()
const { theme, isDark, setTheme, toggleDarkMode, THEMES } = useTheme()
const { palette, setPalette, paletteIds, palettes, paletteTint, setPaletteTint, glassIntensity, setGlassIntensity, glassChrome, setGlassChrome } = useCdPalette()

// Sleeper is kept in code but hidden from the picker for the beta — only the
// glass theme is user-facing for now.
const visibleThemes = computed(() => THEMES.filter((t) => t.id !== 'sleeper'))
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

// Earnest Score — server returns { current_score, dimension_scores };
// label is derived here from score bands to match Earnest's /account page.
const earnestScore = ref<{ current_score: number; dimension_scores: Record<string, number> } | null>(null)

function scoreLabel(score: number): string {
  if (score >= 81) return 'Relentless'
  if (score >= 61) return 'Resolute'
  if (score >= 41) return 'Steady'
  if (score >= 21) return 'Builder'
  return 'Seeker'
}

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
      <NuxtLink to="/" class="cd-back"><CdIcon emoji="‹" icon="lucide:chevron-left" :size="14" /> Back</NuxtLink>

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
            <div style="font-size: 32px; font-weight: 800; color: var(--cd-accent)">{{ earnestScore.current_score }}</div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: var(--cd-text)">{{ scoreLabel(earnestScore.current_score) }}</div>
              <div style="font-size: 11px; color: var(--cd-muted)">Your CRM activity in CardDesk contributes to this score</div>
            </div>
          </div>
          <div v-if="earnestScore.dimension_scores" style="display: flex; flex-direction: column; gap: 4px">
            <div v-for="(value, key) in earnestScore.dimension_scores" :key="key" style="display: flex; align-items: center; gap: 8px">
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
            v-for="t in visibleThemes"
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
          <PhoneDarkModeToggle />
        </div>
      </div>

      <!-- Palette + tint — glass-only enhancement -->
      <div v-if="theme === 'glass'" class="acct-section">
        <div class="acct-section-title">Palette</div>
        <div class="acct-pal-grid">
          <button
            v-for="id in paletteIds"
            :key="id"
            class="acct-pal-card"
            :class="{ active: palette === id }"
            @click="setPalette(id)"
          >
            <div class="acct-pal-swatches">
              <span
                v-for="(c, i) in palettes[id].sourceColors.slice(0, 5)"
                :key="i"
                class="acct-pal-dot"
                :style="`background: hsl(${c.h} ${c.s}% ${c.l}%)`"
              />
            </div>
            <div class="acct-pal-info">
              <span class="acct-pal-name">{{ palettes[id].meta.label }}</span>
              <span class="acct-pal-desc">{{ palettes[id].meta.hint }}</span>
            </div>
            <span class="acct-pal-check">{{ palette === id ? '✓' : '' }}</span>
          </button>
        </div>

        <div class="acct-dm-row" style="margin-top: 10px">
          <div>
            <div class="acct-dm-label">Palette Tint</div>
            <div class="acct-dm-desc">
              {{ paletteTint ? 'Bottom nav + status bar wear the palette gradient' : 'Surfaces stay frosted grey' }}
            </div>
          </div>
          <button
            type="button"
            class="acct-pal-toggle"
            :class="{ on: paletteTint }"
            :aria-pressed="paletteTint"
            @click="setPaletteTint(!paletteTint)"
          >
            <span class="acct-pal-toggle-knob" />
          </button>
        </div>

        <div style="margin-top: 14px">
          <div class="acct-dm-label" style="margin-bottom: 8px">Glass Intensity</div>
          <div class="cd-tabs acct-glass-seg" role="tablist">
            <button
              type="button"
              class="cd-tab ios-press"
              :class="{ on: glassIntensity === 'full' }"
              :aria-selected="glassIntensity === 'full'"
              @click="setGlassIntensity('full')"
            >Full</button>
            <button
              type="button"
              class="cd-tab ios-press"
              :class="{ on: glassIntensity === 'restrained' }"
              :aria-selected="glassIntensity === 'restrained'"
              @click="setGlassIntensity('restrained')"
            >Restrained</button>
          </div>
          <div class="acct-dm-desc" style="margin-top: 8px">
            {{ glassIntensity === 'full'
              ? 'Ambient tint + translucent liquid-glass cards'
              : 'Clean flat cards, glass only on nav & bars' }}
          </div>
        </div>

        <div class="acct-dm-row" style="margin-top: 14px">
          <div>
            <div class="acct-dm-label">Glass Chrome</div>
            <div class="acct-dm-desc">
              {{ glassChrome
                ? 'Frosted buttons + chips with palette-tinted accents'
                : 'Solid accent buttons & chips' }}
            </div>
          </div>
          <button
            type="button"
            class="acct-pal-toggle"
            :class="{ on: glassChrome }"
            :aria-pressed="glassChrome"
            @click="setGlassChrome(!glassChrome)"
          >
            <span class="acct-pal-toggle-knob" />
          </button>
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

/* Palette picker — mirrors .acct-theme-card layout so the two sections
 * read as siblings. Swatches lift 5 evenly-spaced colours from the
 * palette's source list for an at-a-glance ramp. */
.acct-pal-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.acct-pal-card {
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
.acct-pal-card:hover {
  border-color: var(--cd-dim);
}
.acct-pal-card.active {
  border-color: var(--cd-accent);
}
.acct-pal-swatches {
  display: flex;
  align-items: center;
  gap: 0;
  width: 56px;
  height: 28px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}
.acct-pal-dot {
  flex: 1;
  height: 100%;
}
.acct-pal-info {
  flex: 1;
  min-width: 0;
}
.acct-pal-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
}
.acct-pal-desc {
  display: block;
  font-size: 11px;
  color: var(--cd-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.acct-pal-check {
  font-size: 14px;
  color: var(--cd-accent);
  font-weight: 700;
  width: 20px;
  text-align: center;
}

/* Toggle switch — full-pill track + sliding knob. Matches the universal
 * pill aesthetic from Phase 1. */
.acct-pal-toggle {
  position: relative;
  width: 44px;
  height: 26px;
  border-radius: 9999px;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg);
  cursor: pointer;
  padding: 0;
  transition: background 0.18s, border-color 0.18s;
  flex-shrink: 0;
}
.acct-pal-toggle.on {
  background: var(--cd-accent);
  border-color: var(--cd-accent);
}
.acct-pal-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.acct-pal-toggle.on .acct-pal-toggle-knob {
  transform: translateX(18px);
}
.acct-glass-seg {
  display: flex;
  width: 100%;
}
.acct-glass-seg .cd-tab {
  flex: 1;
  justify-content: center;
}
</style>
