export function useAuth() {
  const { user, loggedIn, fetch: fetchSession, clear: clearSession } = useUserSession()
  const router = useRouter()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function login(email: string, password: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
      await fetchSession()
      await router.push('/')
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Login failed'
      throw err
    } finally { loading.value = false }
  }

  async function logout() {
    loading.value = true
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
      await clearSession()
      await router.push('/login')
    } finally { loading.value = false }
  }

  return { user, loggedIn, login, logout, loading, error }
}
