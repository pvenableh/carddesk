/**
 * GET /api/version — the authoritative "what build is live right now?" oracle.
 *
 * Nuxt already publishes `_nuxt/builds/latest.json`, and the client checks that
 * too, but it is a static asset on the CDN: it can be edge-cached, and on some
 * hosting configurations it is absent entirely. This route is served by the
 * running function itself, so it cannot be stale relative to the code that
 * answers it — if this responds, THIS is the deployed build.
 *
 * Public on purpose (no session needed): a logged-out tab sitting on the
 * landing page has exactly the same staleness problem as a signed-in one.
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  // Belt and braces with the routeRule in nuxt.config — an intermediary that
  // ignores one of these has to ignore both to poison the oracle.
  setResponseHeader(event, 'cache-control', 'no-cache, no-store, max-age=0, must-revalidate')
  const release = (config.public.release || {}) as {
    sha?: string
    short?: string
    ref?: string
    builtAt?: string
  }
  return {
    /** The update handshake key — changes on EVERY build. */
    buildId: config.app?.buildId || '',
    /** Human-traceable: which commit, which branch, built when. */
    sha: release.sha || '',
    short: release.short || '',
    ref: release.ref || '',
    builtAt: release.builtAt || '',
    now: new Date().toISOString(),
  }
})
