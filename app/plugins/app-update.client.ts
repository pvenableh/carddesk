/**
 * Keep every long-lived CardDesk client on the latest deploy.
 *
 * An installed PWA is never "reloaded" the way a browser tab is — iOS and
 * Android keep the standalone window alive for days, so a client can sit on a
 * build whose JS chunks no longer exist on the CDN. Two failure modes follow:
 * stale UI (the user swears the bug isn't fixed) and hard breakage (a lazy route
 * chunk 404s mid-navigation).
 *
 * Detection runs on SIX independent signals, so no single dead channel can
 * strand a client:
 *
 *   1. Nuxt's build manifest — every build writes its id to
 *      `_nuxt/builds/latest.json`, re-checked around route changes
 *      (`experimental.checkOutdatedBuildInterval`), firing `app:manifest:update`.
 *   2. A server header handshake — every /api response carries `x-app-build`
 *      (server/middleware/app-build.ts); the fetch wrapper below compares it on
 *      every call, so a stale client learns the moment it talks to a newer
 *      server, even mid-rollout.
 *   3. A visibility-gated poll of /api/version — a PWA parked on one screen for
 *      days never navigates and never calls an API; this covers it, on resume
 *      and on a slow timer while visible.
 *   4. The service worker — @vite-pwa/nuxt flips `$pwa.needRefresh` when a new
 *      worker is waiting. This is the signal that fires for a client that is
 *      offline-first and hasn't talked to the server at all.
 *   5. The service worker again, from the OTHER side: it re-checks the version
 *      whenever it wakes for a push and messages any open client
 *      (`cd-version`), and `controllerchange` tells us a new worker took over.
 *   6. The cross-tab bus — whichever window notices first tells the rest
 *      (BroadcastChannel, with a localStorage fallback). Five tabs and the
 *      installed app all move together instead of drifting apart.
 *
 * What we DO about it is one rule:
 *   the page is hidden  → apply now, silently. Nobody is looking, nothing is
 *                         lost — UNLESS something registered an update blocker
 *                         (a dirty form), in which case we hold and the toast
 *                         is waiting when they come back.
 *   the page is visible → raise the flag and let <AppUpdateToast> ask.
 *
 * A chunk 404 is the one case with no choice — handled by
 * `emitRouteChunkError: 'automatic-immediate'` (nuxt.config), because the app is
 * already broken by the time we'd get to ask.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const buildId = config.app.buildId
  const release = (config.public.release || {}) as { short?: string; ref?: string; builtAt?: string }

  // Handy when someone reports "did my change land?" — the console says exactly
  // which build this client is running (the account footer shows it too).
  console.info(
    `[cd] build ${buildId || '(dev)'}${release.short ? ` · ${release.short}` : ''}${release.ref ? ` · ${release.ref}` : ''}`,
  )

  const {
    pending,
    markPending,
    applyUpdate,
    hasBlockers,
    checkNow,
    _openChannel,
    _doReload,
    _claimReload,
    _LS_KEY,
  } = useAppUpdate()

  // How long the app must have been backgrounded before a resume is worth a
  // freshness check. Short enough to catch "reopen from the home screen", long
  // enough that an app-switcher glance doesn't cause a network round-trip.
  const RESUME_THRESHOLD = 60_000
  // How often a VISIBLE, idle app re-checks. Nuxt only polls around navigations;
  // a page left open and untouched would otherwise never learn it is stale.
  const VISIBLE_POLL = 5 * 60_000

  let hiddenAt = 0
  let checking = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  /** Take the update without asking — unless something says it isn't safe. */
  function silentApply() {
    if (hasBlockers()) return
    void applyUpdate({ silent: true })
  }

  function onUpdateFound(build?: string) {
    if (pending.value) return
    markPending(build)
  }

  // One rule, one place: the moment this client is known to be stale, a HIDDEN
  // page takes the update immediately (nobody is looking, nothing is lost) and
  // a VISIBLE one raises the toast. Every signal below funnels through
  // `pending`, so none of them has to remember this.
  watch(pending, (stale) => {
    if (stale && document.visibilityState === 'hidden') silentApply()
  })

  // ── Signal 3: explicit version check (see useAppUpdate → checkNow) ─────────
  async function checkLatest() {
    if (pending.value || checking || !buildId) return
    checking = true
    try {
      await checkNow()
    } finally {
      checking = false
    }
  }

  function startPoll() {
    if (pollTimer || !buildId) return
    pollTimer = setInterval(checkLatest, VISIBLE_POLL)
  }
  function stopPoll() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  // ── Signal 1: Nuxt's own manifest check (around navigations) ───────────────
  nuxtApp.hook('app:manifest:update', () => onUpdateFound())

  // ── Signal 2: the x-app-build header on every same-origin API response ─────
  // Cross-origin responses (Directus, fonts, Stripe) hide the header behind
  // CORS; we simply see nothing and move on.
  if (buildId && typeof window.fetch === 'function') {
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await nativeFetch(...args)
      try {
        const served = res.headers.get('x-app-build')
        if (served && served !== buildId) onUpdateFound(served)
      } catch {
        /* opaque response — header not readable; ignore */
      }
      return res
    }
  }

  // ── Signal 3 (cont): resume check + visible poll ───────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      stopPoll()
      // They walked away with the toast still up (or never saw it) — take the
      // update now rather than making them tap anything on return.
      if (pending.value) silentApply()
      return
    }
    startPoll()
    if (Date.now() - hiddenAt > RESUME_THRESHOLD) checkLatest()
  })

  // iOS restores a backgrounded home-screen app from the page cache, where
  // `visibilitychange` does not always fire but `pageshow` does.
  window.addEventListener('pageshow', () => {
    if (document.visibilityState !== 'visible') return
    startPoll()
    if (Date.now() - hiddenAt > RESUME_THRESHOLD) checkLatest()
  })

  if (document.visibilityState === 'visible') startPoll()

  // ── Signal 4: the service worker has a new build waiting ───────────────────
  const pwa = nuxtApp.$pwa as { needRefresh?: boolean } | undefined
  if (pwa) {
    watch(
      () => pwa.needRefresh,
      (need) => {
        if (need) onUpdateFound()
      },
      { immediate: true },
    )
  }

  // ── Signal 5: messages from the service worker ─────────────────────────────
  if ('serviceWorker' in navigator) {
    // Whether a worker was ALREADY driving this page when it loaded. The very
    // first service worker also fires `controllerchange` when it calls
    // clients.claim(), and that one is not an update — it's this page's first
    // ever worker. Reloading there would give every new visitor a pointless
    // extra page load.
    const hadController = !!navigator.serviceWorker.controller

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data
      if (!data || typeof data !== 'object') return
      // The SW woke for a push, checked /api/version, and found us behind.
      if (data.type === 'cd-version' && data.buildId && buildId && data.buildId !== buildId) {
        onUpdateFound(data.buildId)
      }
      // A new worker just activated. Controlled pages also get
      // `controllerchange` below; this covers a page that wasn't controlled yet.
      if (data.type === 'cd-sw-activated') void checkLatest()
    })

    // A new worker took control — either because this tab applied an update, or
    // because ANOTHER tab (or window, or the installed app) did. Either way the
    // bytes this page is running were just invalidated: the new worker cleans
    // out the old precache, so staying put means broken lazy chunks.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return
      markPending()
      if (hasBlockers() && document.visibilityState === 'visible') return
      if (_claimReload()) _doReload()
    })
  }

  // ── Signal 6: the cross-tab bus ────────────────────────────────────────────
  function onBusMessage(msg: { type?: string; build?: string } | null) {
    if (!msg) return
    if (msg.type === 'available') {
      // The `pending` watcher above decides what to do about it.
      markPending(msg.build)
    } else if (msg.type === 'applying') {
      // Another window is switching to the new build right now. Follow it —
      // matching what the user just chose, in every window they have open.
      markPending(msg.build)
      if (hasBlockers() && document.visibilityState === 'visible') return
      if (_claimReload()) _doReload()
    }
  }

  const channel = _openChannel()
  if (channel) {
    channel.addEventListener('message', (event) => onBusMessage(event.data))
  }
  // Fallback bus for engines without BroadcastChannel (and belt-and-braces
  // everywhere else — `storage` only fires in OTHER tabs, which is what we want).
  window.addEventListener('storage', (event) => {
    if (event.key !== _LS_KEY || !event.newValue) return
    try {
      onBusMessage(JSON.parse(event.newValue))
    } catch {
      /* someone else's malformed write — ignore */
    }
  })
})
