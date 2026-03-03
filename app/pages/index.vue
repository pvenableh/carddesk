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
    </div>
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
  height: 100vh;
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
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 32px 80px rgba(0, 0, 0, 0.95);
}
.cd-notch {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 88px;
  height: 26px;
  background: #000;
  border-radius: 20px;
  z-index: 100;
}
.cd-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.cd-sbar {
  padding: 44px 20px 0;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--cd-muted);
}
</style>
