<script setup lang="ts">
const { user } = useUserSession()
const { logout } = useAuth()
const router = useRouter()
const { nav } = useNavigation()
const { show: openShareSheet } = useShareSheet()

// Logo → home (the Vibe screen). If we somehow aren't on the app route,
// route there first.
function goHome() {
  if (router.currentRoute.value.path !== '/') router.push('/')
  nav('vibe')
}

const dropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const initials = computed(() => {
  const email = user.value?.email as string | undefined
  if (!email) return '?'
  return email.charAt(0).toUpperCase()
})

const time = ref('')
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  time.value = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  timer = setInterval(() => {
    time.value = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }, 10000)
})

function goEditCard() {
  closeDropdown()
  router.push('/card/edit')
}

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
    <button class="cd-sbar-logo" type="button" aria-label="Home" @click="goHome"><span class="cd-sbar-logo-brand">CARD</span><span class="cd-sbar-logo-accent">DESK</span></button>
    <div class="cd-sbar-right">
      <button class="cd-sbar-share" type="button" aria-label="Share card or invite" @click="openShareSheet('card')"><CdIcon emoji="📤" icon="lucide:share" :size="15" /></button>
      <PhoneCreditGauge />
    <div ref="dropdownRef" class="cd-avatar-wrap">
      <button class="cd-avatar" @click="toggleDropdown">{{ initials }}</button>
      <Transition name="cd-dropdown">
        <div v-if="dropdownOpen" class="cd-dropdown">
          <button class="cd-dd-item" @click="goAccount">
            <span class="cd-dd-icon"><CdIcon emoji="👤" icon="lucide:user" /></span>
            Account
          </button>
          <button class="cd-dd-item" @click="goEditCard">
            <span class="cd-dd-icon"><CdIcon emoji="🪪" icon="lucide:contact" /></span>
            Edit My Card
          </button>
          <div class="cd-dd-divider" />
          <div class="cd-dd-credits">
            <PhoneCreditMeter />
          </div>
          <div class="cd-dd-divider" />
          <div class="cd-dd-appearance">
            <PhoneAppearancePanel />
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
  position: relative;
}
.cd-sbar-time {
  min-width: 50px;
}
/* Centered via auto-margins rather than translateX(-50%): the global glass
 * button :active rule applies its own transform: scale(), which would wipe out
 * a centering transform and make the logo jump. Margins keep it put. */
.cd-sbar-logo {
  font-family: monospace;
  font-size: 15px;
  letter-spacing: 2px;
  position: absolute;
  left: 0;
  right: 0;
  margin: 0 auto;
  width: fit-content;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font-weight: inherit;
  cursor: pointer;
}
.cd-sbar-logo-brand {
  color: var(--cd-chrome-accent, var(--cd-palette-primary, hsl(213 64% 52%)));
}
.cd-sbar-logo-accent {
  color: var(--cd-accent);
}
.cd-sbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cd-sbar-share {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-bdr);
  color: var(--cd-text);
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}
.cd-sbar-share:hover {
  border-color: var(--cd-accent);
  color: var(--cd-accent);
}
.cd-avatar-wrap {
  position: relative;
}
.cd-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--cd-bg2);
  border: 1.5px solid var(--cd-bdr);
  color: var(--cd-text);
  font-size: 13px;
  font-weight: 800;
  font-family: sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.15s;
}
.cd-avatar:hover {
  border-color: var(--cd-accent);
}
.cd-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 288px;
  max-height: min(70vh, 560px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 14px;
  padding: 6px;
  z-index: 100;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}
.cd-dd-appearance {
  padding: 6px 4px;
}
.cd-dd-credits {
  padding: 6px 4px;
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
