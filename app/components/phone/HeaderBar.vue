<script setup lang="ts">
import type { ThemeId } from '~/composables/useTheme'

const { user } = useUserSession()
const { logout } = useAuth()
const { theme, isDark, setTheme, toggleDarkMode, THEMES } = useTheme()
const router = useRouter()

const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const initials = computed(() => {
  const email = user.value?.email as string | undefined
  if (!email) return '?'
  return email.charAt(0).toUpperCase()
})

const time = ref(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    time.value = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }, 10000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown() {
  dropdownOpen.value = false
}

function goAccount() {
  closeDropdown()
  router.push('/account')
}

async function handleLogout() {
  closeDropdown()
  await logout()
}

function selectTheme(id: ThemeId) {
  setTheme(id)
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})

function onClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    closeDropdown()
  }
}
</script>

<template>
  <div class="cd-sbar">
    <span class="cd-sbar-time">{{ time }}</span>
    <span class="cd-sbar-logo">Card<span class="cd-sbar-logo-accent">Desk</span></span>
    <div ref="dropdownRef" class="cd-avatar-wrap">
      <button class="cd-avatar" @click="toggleDropdown">
        {{ initials }}
      </button>
      <Transition name="cd-dropdown">
        <div v-if="dropdownOpen" class="cd-dropdown">
          <button class="cd-dd-item" @click="goAccount">
            <span class="cd-dd-icon"><CdIcon emoji="👤" icon="lucide:user" /></span>
            Account
          </button>
          <div class="cd-dd-divider" />
          <div class="cd-dd-label">Theme</div>
          <button
            v-for="t in THEMES"
            :key="t.id"
            class="cd-dd-item cd-dd-theme"
            :class="{ active: theme === t.id }"
            @click="selectTheme(t.id)"
          >
            <span class="cd-dd-check">{{ theme === t.id ? '●' : '○' }}</span>
            <span>
              <span class="cd-dd-theme-name">{{ t.label }}</span>
              <span class="cd-dd-theme-desc">{{ t.description }}</span>
            </span>
          </button>
          <div class="cd-dd-row">
            <span class="cd-dd-row-label">Dark Mode</span>
            <UiDarkModeToggle />
          </div>
          <div class="cd-dd-divider" />
          <button class="cd-dd-item cd-dd-logout" @click="handleLogout">
            <span class="cd-dd-icon"><CdIcon emoji="↪" icon="lucide:log-out" /></span>
            Log Out
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.cd-sbar {
  padding: calc(env(safe-area-inset-top, 8px) + 6px) 20px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--cd-muted);
  background: var(--cd-bg);
  z-index: 10;
}
.cd-sbar-time {
  min-width: 50px;
}
.cd-sbar-logo {
  font-family: monospace;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}
.cd-sbar-logo-accent {
  color: var(--cd-accent);
}
.cd-avatar-wrap {
  position: relative;
}
.cd-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-bdr);
  color: var(--cd-text);
  font-size: 12px;
  font-weight: 800;
  font-family: sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s;
}
.cd-avatar:hover {
  border-color: var(--cd-accent);
}
.cd-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 200px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 14px;
  padding: 6px;
  z-index: 100;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}
.cd-dd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  background: none;
  color: var(--cd-text);
  font-size: 13px;
  font-weight: 600;
  font-family: sans-serif;
  cursor: pointer;
  border-radius: 10px;
  transition: background 0.12s;
  text-align: left;
}
.cd-dd-item:hover {
  background: rgba(255, 255, 255, 0.05);
}
.cd-dd-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}
.cd-dd-divider {
  height: 1px;
  background: var(--cd-bdr);
  margin: 4px 8px;
}
.cd-dd-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--cd-dim);
  padding: 6px 10px 2px;
}
.cd-dd-theme {
  gap: 6px;
}
.cd-dd-check {
  font-size: 8px;
  width: 16px;
  text-align: center;
  color: var(--cd-dim);
  flex-shrink: 0;
}
.cd-dd-theme.active .cd-dd-check {
  color: var(--cd-accent);
}
.cd-dd-theme-name {
  display: block;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}
.cd-dd-theme-desc {
  display: block;
  font-size: 10px;
  color: var(--cd-dim);
  font-weight: 500;
}
.cd-dd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
}
.cd-dd-row-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--cd-text);
}
.cd-dd-logout {
  color: #f87171;
}
.cd-dd-logout:hover {
  background: rgba(248, 113, 113, 0.08);
}

/* Dropdown transition */
.cd-dropdown-enter-active {
  transition: all 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
}
.cd-dropdown-leave-active {
  transition: all 0.12s ease;
}
.cd-dropdown-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.95);
}
.cd-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}
</style>
