/**
 * Proactively re-validate auth when the app returns to the foreground.
 *
 * An installed PWA (or a backgrounded browser tab) can sit unopened for hours.
 * Without this, the app only discovers its access token expired — or refreshes
 * it / slides the session window — on the *next* data request, which can flash a
 * stale/logged-out state on resume. This pings the authed heartbeat on
 * visibility/focus so the session is confirmed and renewed before the user
 * touches anything.
 *
 * Works identically in a normal browser tab and an installed PWA — it keys off
 * `visibilitychange`/`focus`, not display mode.
 */
export default defineNuxtPlugin(() => {
  const { loggedIn, fetch: fetchSession, clear: clearSession } = useUserSession()
  const router = useRouter()

  let last = 0
  const THROTTLE_MS = 30_000 // rapid focus/visibility toggles shouldn't spam the server

  async function revalidate() {
    if (!loggedIn.value) return // nothing to confirm on the login/marketing screens
    const now = Date.now()
    if (now - last < THROTTLE_MS) return
    last = now
    try {
      // Server round-trip: refreshes the Directus token + slides the window if
      // due; 401 means the session is genuinely dead.
      await $fetch('/api/auth/heartbeat')
      await fetchSession() // sync client loggedIn/user from the (re-sealed) cookie
    } catch (err: any) {
      const status = err?.statusCode ?? err?.response?.status ?? err?.status
      if (status === 401) {
        await clearSession()
        await router.replace('/login')
      }
      // Transient (503/network): leave the session intact and retry next resume.
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revalidate()
  })
  window.addEventListener('focus', revalidate)
})
