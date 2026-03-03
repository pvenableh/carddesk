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
const { toast, loadXp } = useXp()
const { screen, nav, transitionName } = useNavigation()
const { theme } = useTheme()

const rootClass = computed(() => ['cd-root', theme.value === 'modern' ? 'cd-modern' : ''])

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
  await Promise.all([fetchContacts(), loadXp()])
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
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}
.cd-root.cd-modern {
  font-family: "Proxima Nova", sans-serif;
  letter-spacing: 0.01em;
}
.cd-screens {
  flex: 1;
  overflow: hidden;
  position: relative;
}
</style>
