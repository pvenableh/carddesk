/**
 * Opens the buy-credits modal when one of OUR API calls 402s (depleted AI
 * balance). Scoped to same-origin `/api/` requests so an unrelated 402 from a
 * third-party or non-credit endpoint can't trigger the credits CTA.
 *
 * IMPORTANT: we delegate to the original $fetch rather than $fetch.create() —
 * .create() drops Nuxt's request interceptors (cookie forwarding, baseURL),
 * which would make every authenticated call 401. The delegate wrapper keeps
 * all original behavior and only adds the 402 side-effect; the error still
 * throws so call sites can show their own message.
 *
 * Note: this only intercepts direct `$fetch()` calls (which is how every
 * credit-gated AI call is made). `$fetch.raw`/`useFetch` are not wrapped.
 */
function isOwnApiRequest(request: any): boolean {
  const url = typeof request === 'string' ? request : (request?.url ?? '')
  if (typeof url !== 'string') return false
  // Relative `/api/...` (the Nuxt convention here) or same-origin `/api/...`.
  if (url.startsWith('/api/')) return true
  try {
    const u = new URL(url, window.location.origin)
    return u.origin === window.location.origin && u.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

export default defineNuxtPlugin(() => {
  const original = globalThis.$fetch
  if (!original || (original as any).__creditGuard) return

  // Capture the state ref during plugin setup (valid Nuxt context).
  const showBuyModal = useState<boolean>('cd_buy_modal', () => false)

  const wrapped = ((request: any, options?: any) =>
    original(request, options).catch((err: any) => {
      const status = err?.status ?? err?.statusCode ?? err?.response?.status
      if (status === 402 && isOwnApiRequest(request)) {
        showBuyModal.value = true
      }
      throw err
    })) as typeof globalThis.$fetch

  // Preserve $fetch.raw / .create / .native and any other props.
  Object.assign(wrapped, original)
  ;(wrapped as any).__creditGuard = true
  globalThis.$fetch = wrapped
})
