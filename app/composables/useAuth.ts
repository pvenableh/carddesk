export function useAuth() {
  const { user, loggedIn, fetch: fetchSession, clear: clearSession } = useUserSession()
  const router = useRouter()
  const analytics = useAnalytics()
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function login(email: string, password: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
      await fetchSession()
      analytics.login()
      // replace, not push: leaving /login in history means the browser back
      // button bounces the just-authenticated user straight back to the login
      // screen. Replacing it drops /login from the stack.
      await router.replace('/')
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Login failed'
      throw err
    } finally { loading.value = false }
  }

  async function register(data: { email: string; password: string; first_name?: string; last_name?: string; industry?: string; title?: string; location?: string }) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/register', { method: 'POST', body: data })
      await fetchSession()
      analytics.signUp()
      // replace so the registration screen doesn't sit in history behind the app.
      await router.replace('/')
    } catch (err: any) {
      // Email already on the shared instance but the password didn't match —
      // send them to sign in (a pending invite redeems after login) instead of
      // dead-ending on an error.
      if (err?.data?.data?.reason === 'account_exists') {
        await router.replace({ path: '/login', query: { email: data.email, exists: '1' } })
        throw err
      }
      error.value = err?.data?.message ?? 'Registration failed'
      throw err
    } finally { loading.value = false }
  }

  async function requestPasswordReset(email: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/password-request', { method: 'POST', body: { email } })
      analytics.passwordResetRequest()
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Request failed'
      throw err
    } finally { loading.value = false }
  }

  async function resetPassword(token: string, password: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/password-reset', { method: 'POST', body: { token, password } })
      analytics.passwordResetComplete()
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Password reset failed'
      throw err
    } finally { loading.value = false }
  }

  async function acceptInvite(token: string, password: string) {
    loading.value = true; error.value = null
    try {
      await $fetch('/api/auth/accept-invite', { method: 'POST', body: { token, password } })
      analytics.inviteAccept()
    } catch (err: any) {
      error.value = err?.data?.message ?? 'Failed to accept invitation'
      throw err
    } finally { loading.value = false }
  }

  async function logout() {
    loading.value = true
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
      analytics.logout()
      await clearSession()
      // replace: the logged-out user shouldn't be able to "back" into the
      // now-dead authenticated app shell.
      await router.replace('/login')
    } finally { loading.value = false }
  }

  return { user, loggedIn, login, register, requestPasswordReset, resetPassword, acceptInvite, logout, loading, error }
}
