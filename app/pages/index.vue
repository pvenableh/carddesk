<script setup lang="ts">
import type { Screen } from '~/composables/useNavigation'
import PhoneVibeScreen from '~/components/phone/VibeScreen.vue'
import PhoneSessionScreen from '~/components/phone/SessionScreen.vue'
import PhoneColdScreen from '~/components/phone/ColdScreen.vue'
import PhoneHomeScreen from '~/components/phone/HomeScreen.vue'
import PhoneContactsScreen from '~/components/phone/ContactsScreen.vue'
import PhoneDetailScreen from '~/components/phone/DetailScreen.vue'
import PhoneAddContactScreen from '~/components/phone/AddContactScreen.vue'

definePageMeta({ middleware: 'auth' })

const { fetchContacts, followUpStatus, contacts } = useContacts()
const { toast, loadXp, earn } = useXp()
const { loadProfile } = useProfile()
const { screen, nav, transitionName } = useNavigation()
const { theme } = useTheme()
const { load: loadConnections } = useConnections()
// Pending invite stashed by /i/[code] before the user signed up. Redeemed on
// first authenticated load so the new user lands already connected.
const inviteCookie = useCookie<string | null>('cd_invite', { path: '/' })

const rootClass = computed(() => ['cd-root', theme.value === 'glass' ? 'cd-glass' : ''])

const screenComponents: Record<Screen, Component> = {
  vibe: PhoneVibeScreen,
  session: PhoneSessionScreen,
  cold: PhoneColdScreen,
  home: PhoneHomeScreen,
  contacts: PhoneContactsScreen,
  detail: PhoneDetailScreen,
  add: PhoneAddContactScreen,
}

const currentScreen = computed(() => screenComponents[screen.value])

const alertCs = computed(() =>
  contacts.value.filter((c) => !c.hibernated && followUpStatus(c) === 'overdue')
)

onMounted(async () => {
  await Promise.all([fetchContacts(), loadXp(), loadProfile()])

  // Redeem a pending invite (set by /i/[code] before signup).
  if (inviteCookie.value) {
    const code = inviteCookie.value
    inviteCookie.value = null
    try {
      const { inviter } = await $fetch<{ inviter?: { name?: string } }>('/api/invite/redeem', {
        method: 'POST',
        body: { code },
      })
      earn(25, '🎉', `Joined — connected with ${inviter?.name ?? 'your inviter'}!`)
      loadConnections(true)
    } catch { /* invalid/expired/already connected — ignore */ }
  }
})
</script>

<template>
  <div :class="rootClass">
    <PhoneHeaderBar />

    <!-- Screens with iOS-like transitions -->
    <div class="cd-screens">
      <Transition :name="transitionName" mode="out-in">
        <KeepAlive>
          <component :is="currentScreen" :key="screen" />
        </KeepAlive>
      </Transition>
    </div>

    <!-- Bottom Nav -->
    <PhoneBottomNav
      :active="screen"
      :alert-count="alertCs.length"
      @nav="nav"
    />

    <!-- XP Toast -->
    <PhoneXpToast :toast="toast" />

    <!-- Global share sheet (My Card / Invite) -->
    <PhoneShareSheet />

    <!-- Scoring cheat-sheet flyout -->
    <PhoneScoreGuide />

    <!-- PWA install prompt -->
    <CdInstallPrompt />
  </div>
</template>

<style scoped>
.cd-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--cd-bg);
  color: var(--cd-text);
  font-family: 'Barlow', sans-serif;
}
.cd-root.cd-glass {
  font-family: "Proxima Nova", sans-serif;
  letter-spacing: 0.01em;
}
.cd-screens {
  flex: 1;
  overflow: hidden;
  position: relative;
  max-width: 768px;
  margin: 0 auto;
  width: 100%;
}
</style>
