/**
 * Shared "a newer deploy exists" state, plus the cross-tab bus that keeps every
 * CardDesk window in a browser on the same build.
 *
 * Detection lives in app/plugins/app-update.client.ts. The UI lives in
 * <AppUpdateToast>. This is the seam between them — and the only place that
 * knows how to actually APPLY an update, which is subtler than "reload":
 * CardDesk ships a service worker in `prompt` mode, so a new SW parks itself in
 * "waiting" and a plain reload would be served the OLD precached assets by the
 * OLD worker, forever. The update only lands once the waiting worker is told to
 * skipWaiting. See applyUpdate().
 */

export interface AppBuildInfo {
  buildId: string
  sha?: string
  short?: string
  ref?: string
  builtAt?: string
}

/** Cross-tab channel name. Same-origin windows only, which is exactly right. */
const CHANNEL = 'cd-app-update'
/** localStorage key used as the fallback bus where BroadcastChannel is missing. */
const LS_KEY = 'cd-app-update-ping'

type BusMessage =
  /** A tab discovered a newer build. */
  | { type: 'available'; build: string }
  /** A tab is applying the update right now — everyone else should follow. */
  | { type: 'applying'; build: string }

let channel: BroadcastChannel | null = null
let busReady = false
/** Set once we have committed to a reload, so nothing can double-fire one. */
let reloading = false

/** Reasons a SILENT (unprompted) reload must wait — e.g. a half-typed form. */
const blockers = new Set<() => boolean>()

function openChannel(): BroadcastChannel | null {
  if (!import.meta.client) return null
  if (channel || busReady) return channel
  busReady = true
  try {
    channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null
  } catch {
    channel = null
  }
  return channel
}

function publish(msg: BusMessage) {
  const ch = openChannel()
  if (ch) {
    try {
      ch.postMessage(msg)
      return
    } catch {
      /* channel closed (page unloading) — fall through to storage */
    }
  }
  // Fallback bus: a `storage` event fires in every OTHER same-origin tab.
  // Stamped so two identical messages still register as two writes.
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...msg, at: Date.now() }))
  } catch {
    /* storage blocked (Safari private) — this tab still updates itself */
  }
}

export function useAppUpdate() {
  const config = useRuntimeConfig()

  /** The build THIS client is running. Empty in dev. */
  const current = computed<AppBuildInfo>(() => ({
    buildId: config.app.buildId || '',
    ...((config.public.release || {}) as Omit<AppBuildInfo, 'buildId'>),
  }))

  /** A newer build is live and this client is still on the old one. */
  const pending = useState<boolean>('app-update-pending', () => false)
  /** User waved the toast away — they stay stale until they background the app. */
  const dismissed = useState<boolean>('app-update-dismissed', () => false)
  /** Build id we detected as "the new one", when we know it. */
  const latestBuild = useState<string>('app-update-latest', () => '')
  /** True from the moment we commit to reloading — drives the toast's spinner. */
  const applying = useState<boolean>('app-update-applying', () => false)

  const show = computed(() => pending.value && !dismissed.value)

  /**
   * Register a veto for SILENT reloads. Return true from `fn` while there is
   * work that a surprise reload would destroy (a dirty form, an in-flight
   * upload). It never blocks a reload the user asked for — tapping Refresh is
   * their call to make.
   *
   * Auto-unregisters with the calling component when there is one.
   */
  function registerUpdateBlocker(fn: () => boolean) {
    blockers.add(fn)
    const stop = () => blockers.delete(fn)
    if (getCurrentInstance()) onScopeDispose(stop)
    return stop
  }

  function hasBlockers(): boolean {
    for (const fn of blockers) {
      try {
        if (fn()) return true
      } catch {
        /* a throwing blocker doesn't get to hold the app hostage */
      }
    }
    return false
  }

  /**
   * Ask the server which build is live, right now.
   *
   * /api/version is answered by the running function, so it cannot be stale
   * relative to the deploy. Nuxt's `latest.json` is the fallback for the case
   * where the API is unreachable but the CDN isn't.
   *
   * Returns the live build id ('' if we couldn't find out). Safe to call from
   * the UI — a "Check for updates" button is just this.
   */
  async function checkNow(): Promise<string> {
    if (!import.meta.client || !current.value.buildId) return ''
    const bust = { _: String(Date.now()) }
    const headers = { 'cache-control': 'no-cache' }
    let live = ''
    try {
      const v = await $fetch<{ buildId?: string }>('/api/version', { query: bust, headers })
      live = v?.buildId || ''
    } catch {
      try {
        const latestUrl = new URL(
          `${config.app.buildAssetsDir || '/_nuxt/'}/builds/latest.json`.replace(/\/{2,}/g, '/'),
          config.app.cdnURL || window.location.origin,
        ).href
        const latest = await $fetch<{ id?: string }>(latestUrl, { query: bust, headers })
        live = latest?.id || ''
      } catch {
        /* offline, or neither oracle is reachable — try again next tick */
      }
    }
    if (live && live !== current.value.buildId) markPending(live)
    return live
  }

  /** Mark this client stale and tell every other tab. Idempotent. */
  function markPending(build?: string) {
    if (build) latestBuild.value = build
    if (pending.value) return
    pending.value = true
    publish({ type: 'available', build: build || '' })
  }

  /**
   * Take the update. Two-step, because a waiting service worker outranks a
   * reload: reloading under the OLD worker just re-serves the OLD precache.
   *
   *   1. Nudge the registration and, if a worker is waiting, tell it to
   *      skipWaiting. The browser fires `controllerchange` once it takes over,
   *      which is our cue that a reload will now be served new bytes.
   *   2. Reload regardless after a short budget — an SSR-only client (no SW,
   *      or a SW that never picked up the new build) must not be stranded
   *      waiting for an event that will never arrive.
   */
  async function applyUpdate(opts?: { silent?: boolean }) {
    if (!import.meta.client) return
    if (opts?.silent && hasBlockers()) return
    if (reloading) return
    reloading = true
    applying.value = true

    publish({ type: 'applying', build: latestBuild.value })

    await activateWaitingWorker()
    doReload()
  }

  /** The raw reload. Full document navigation: new HTML, new chunks, new SW check. */
  function doReload() {
    reloadNuxtApp({
      path: window.location.pathname + window.location.search + window.location.hash,
      persistState: false,
      // Guards against a reload loop if the "new" build is somehow still stale.
      ttl: 10_000,
    })
  }

  return {
    current,
    checkNow,
    pending,
    dismissed,
    latestBuild,
    applying,
    show,
    markPending,
    applyUpdate,
    registerUpdateBlocker,
    hasBlockers,
    // Plugin-only plumbing; components have no reason to touch these.
    _publish: publish,
    _openChannel: openChannel,
    _doReload: doReload,
    _isReloading: () => reloading,
    _claimReload: () => {
      if (reloading) return false
      reloading = true
      return true
    },
    _LS_KEY: LS_KEY,
  }
}

/**
 * Ask a waiting service worker to take over, and resolve when it has (or when
 * we've waited long enough that a plain reload is the better answer).
 *
 * Bounded on purpose: every path here is best-effort, and none of them may
 * prevent the reload that follows.
 */
async function activateWaitingWorker(budgetMs = 2500): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return

    // The update may have been detected by the build-id handshake BEFORE the
    // browser bothered to re-fetch sw.js — give it that chance now.
    if (!reg.waiting) await reg.update().catch(() => {})

    const waiting = reg.waiting || reg.installing
    if (!waiting) return

    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer)
        navigator.serviceWorker.removeEventListener('controllerchange', done)
        resolve()
      }
      const timer = setTimeout(done, budgetMs)
      navigator.serviceWorker.addEventListener('controllerchange', done)
      // A worker still `installing` can't be skipped yet — wait for installed.
      if (waiting.state === 'installed') waiting.postMessage({ type: 'SKIP_WAITING' })
      else
        waiting.addEventListener('statechange', () => {
          if (waiting.state === 'installed') waiting.postMessage({ type: 'SKIP_WAITING' })
        })
    })
  } catch {
    /* nothing here is worth failing a reload over */
  }
}
