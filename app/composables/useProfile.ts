import type { CdUserProfile } from '~/types/directus'

const DEFAULT: CdUserProfile = {
  first_name: '', last_name: '', title: '', industry: '', networking_goal: '', location: '', organization: null,
}

export function useProfile() {
  const profile = useState<CdUserProfile>('cd_profile', () => ({ ...DEFAULT }))
  const loading = ref(false)
  const saved = ref(false)

  async function loadProfile() {
    loading.value = true
    try {
      const data = await $fetch<CdUserProfile | null>('/api/profile')
      if (data) profile.value = data
    } catch { /* silent */ }
    finally { loading.value = false }
  }

  async function saveProfile(updates: Partial<CdUserProfile>) {
    const { organization, location, ...saveable } = updates
    Object.assign(profile.value, updates)
    saved.value = false
    try {
      await $fetch('/api/profile', { method: 'POST', body: saveable })
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
    } catch (err: any) {
      console.error('[useProfile] save failed:', err)
    }
  }

  const fullName = computed(() =>
    [profile.value.first_name, profile.value.last_name].filter(Boolean).join(' ')
  )

  const company = computed(() => profile.value.organization?.name ?? '')

  return { profile, loading, saved, loadProfile, saveProfile, fullName, company }
}
