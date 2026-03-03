<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { fetchContacts, followUpStatus, contacts } = useContacts()
const { toast, loadXp } = useXp()
const { screen, nav } = useNavigation()

const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)

onMounted(async () => {
  await Promise.all([fetchContacts(), loadXp()])
})
</script>

<template>
  <div class="cd-root">
    <div class="cd-phone-col">
      <div class="cd-phone">
        <div class="cd-notch"></div>
        <div class="cd-inner">
          <div class="cd-sbar">
            <span>{{ new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}</span>
            <span style="font-family: monospace">Card<span style="color: #00ff87">Desk</span></span>
          </div>

          <!-- Screens -->
          <VibeScreen v-show="screen === 'vibe'" />
          <SessionScreen v-show="screen === 'session'" />
          <ColdScreen v-show="screen === 'cold'" />
          <HomeScreen v-show="screen === 'home'" />
          <ContactsScreen v-show="screen === 'contacts'" />
          <DetailScreen v-show="screen === 'detail'" />
          <AddContactScreen v-show="screen === 'add'" />

          <!-- Bottom Nav -->
          <BottomNav
            :active="screen"
            :alert-count="alertCs.length"
            @nav="nav"
          />

          <!-- XP Toast -->
          <XpToast :toast="toast" />
        </div>
      </div>

      <!-- ══ UNIFIED NAV BAR ═══════════════════════════════════════════════════ -->
      <nav class="cd-bnav">
        <button
          class="cd-bn"
          :class="{ on: screen === 'vibe' }"
          @click="nav('vibe')"
        >
          <span class="cd-bni">⚡</span>Vibe
        </button>
        <button
          class="cd-bn"
          :class="{ on: screen === 'session' }"
          @click="nav('session')"
        >
          <span class="cd-bni">🎙</span>Session
        </button>
        <button
          class="cd-bn"
          :class="{ on: screen === 'cold' }"
          @click="nav('cold')"
        >
          <span class="cd-bni">❄️</span>Cold
        </button>
        <button
          class="cd-bn"
          :class="{ on: screen === 'home' }"
          @click="nav('home')"
        >
          <span class="cd-bni">🏠</span>Home
        </button>
        <button
          class="cd-bn"
          :class="{ on: ['contacts', 'detail', 'add'].includes(screen) }"
          @click="nav('contacts')"
          style="position: relative"
        >
          <span v-if="alertCs.length" class="cd-nav-dot"></span>
          <span class="cd-bni">{{ screen === 'add' ? '📷' : '👥' }}</span>
          {{ screen === 'add' ? 'Add' : 'Network' }}
        </button>
      </nav>

      <!-- XP Toast -->
      <Transition name="cd-toast">
        <div v-if="toast" class="cd-toast">
          <span style="font-size: 18px">{{ toast.icon }}</span>
          <span
            style="
              font-family: &quot;Bebas Neue&quot;, sans-serif;
              font-size: 20px;
              color: #00ff87;
              letter-spacing: 1px;
            "
            >{{ toast.xp }}</span
          >
          <span style="font-size: 11px; color: #8898b0; font-weight: 600">{{
            toast.msg
          }}</span>
        </div>
      </Transition>
  </div>
</template>

<style scoped>
.cd-root {
  --cd-bg: #060810;
  --cd-bg2: #0d1018;
  --cd-bdr: #1c2330;
  --cd-text: #f0f4ff;
  --cd-muted: #8898b0;
  --cd-dim: #3e4f68;
  --cd-accent: #00ff87;
  --cd-blue: #4da6ff;
  --cd-orange: #ff6b35;
  --cd-purple: #b87dff;
  --cd-ice: #a8d8ea;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Barlow', sans-serif;
  align-items: center;
  justify-content: center;
}
.cd-phone-col {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.cd-phone {
  width: 354px;
  height: 742px;
  background: var(--cd-bg);
  border-radius: 44px;
  overflow: hidden;
  position: relative;
}
.cd-sbar {
  padding: calc(env(safe-area-inset-top, 8px) + 6px) 20px 6px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--cd-muted);
  background: var(--cd-bg);
  z-index: 10;
}
.cd-screens {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
