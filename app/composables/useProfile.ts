import type { CdUserProfile } from '~/types/directus'

const DEFAULT: CdUserProfile = {
  full_name: '', title: '', company: '', industry: '', networking_goal: '',
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
    Object.assign(profile.value, updates)
    saved.value = false
    try {
      await $fetch('/api/profile', { method: 'POST', body: profile.value })
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
    } catch (err: any) {
      console.error('[useProfile] save failed:', err)
    }
  }

  return { profile, loading, saved, loadProfile, saveProfile }
}
