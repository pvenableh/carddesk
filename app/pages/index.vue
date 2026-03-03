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
    <div class="cd-sbar">
      <span>{{ new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}</span>
      <span style="font-family: monospace">Card<span style="color: #00ff87">Desk</span></span>
    </div>

    <!-- Screens -->
    <PhoneVibeScreen v-show="screen === 'vibe'" />
    <PhoneSessionScreen v-show="screen === 'session'" />
    <PhoneColdScreen v-show="screen === 'cold'" />
    <PhoneHomeScreen v-show="screen === 'home'" />
    <PhoneContactsScreen v-show="screen === 'contacts'" />
    <PhoneDetailScreen v-show="screen === 'detail'" />
    <PhoneAddContactScreen v-show="screen === 'add'" />

    <!-- Bottom Nav -->
    <PhoneBottomNav
      :active="screen"
      :alert-count="alertCs.length"
      @nav="nav"
    />

    <!-- XP Toast -->
    <PhoneXpToast :toast="toast" />
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
</style>
