<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useUserSession()
const { logout } = useAuth()
const { theme, isDark, setTheme, toggleDarkMode, THEMES } = useTheme()

const email = computed(() => (user.value?.email as string) ?? '')
const initial = computed(() => email.value.charAt(0).toUpperCase() || '?')
</script>

<template>
  <div class="acct-page">
    <div class="acct-container">
      <NuxtLink to="/" class="acct-back">← Back</NuxtLink>

      <div class="acct-hero">
        <div class="acct-avatar">{{ initial }}</div>
        <div class="acct-email">{{ email }}</div>
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
.acct-theme-preview.modern {
  background: linear-gradient(135deg, #ffffff, #f5f5f7);
  border: 1px solid #e0e0e0;
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
</style>
