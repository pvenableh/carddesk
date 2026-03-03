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

  async function register(data: { email: string; password: string; first_name?: string; last_name?: string }) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/register', { method: 'POST', body: data })
      await fetchSession()
      await router.push('/')
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Registration failed'
      throw err
    } finally { loading.value = false }
  }

  async function requestPasswordReset(email: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/password-request', { method: 'POST', body: { email } })
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Request failed'
      throw err
    } finally { loading.value = false }
  }

  async function resetPassword(token: string, password: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/password-reset', { method: 'POST', body: { token, password } })
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Password reset failed'
      throw err
    } finally { loading.value = false }
  }

  async function acceptInvite(token: string, password: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/accept-invite', { method: 'POST', body: { token, password } })
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Failed to accept invitation'
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

  return { user, loggedIn, login, register, requestPasswordReset, resetPassword, acceptInvite, logout, loading, error }
}
