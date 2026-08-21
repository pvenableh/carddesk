/**
 * Keep the OS app-icon badge honest (installed PWA on iOS, macOS dock,
 * Windows taskbar).
 *
 * There are two writers, on purpose:
 *  - the service worker, which is the only thing running when a push lands with
 *    no page open — which is exactly when a home-screen badge matters; and
 *  - this one, which CORRECTS it, because the worker's counter is optimistic.
 *    Every CardDesk push is a nudge (follow-up due, streak about to break, card
 *    scanned elsewhere) with no unread row behind it, so the worker just does
 *    +1 and has no way to know the user has since dealt with it.
 *
 * Opening the app IS reading those nudges, so the correction is simply: on
 * foreground, zero it.
 *
 * The subtle part is what "foreground" means for an installed PWA. It is
 * *resumed*, not reloaded — tapping the home-screen icon hands you the same
 * page back, with no remount and no navigation. So a badge the worker raised
 * while we were backgrounded would otherwise stick to the icon forever. Hence
 * both `visibilitychange` and `pageshow` (iOS restores from the page cache,
 * where the former does not always fire).
 *
 * We never clear on unmount: the badge is meant to outlive the page.
 */
type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Write a count to the OS badge AND to the worker's persisted counter. */
export function setAppBadge(count: number) {
  if (!import.meta.client) return
  const nav = navigator as BadgeNavigator
  const v = Math.max(0, Math.floor(count) || 0)
  if (nav.setAppBadge) {
    if (v > 0) nav.setAppBadge(v).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  }
  // Keep the worker's counter from drifting above what we know is outstanding —
  // otherwise the next push it can't count would build on a stale number.
  nav.serviceWorker?.ready
    .then((reg) => (nav.serviceWorker?.controller ?? reg.active)?.postMessage({ type: 'badge', count: v }))
    .catch(() => {})
}

/**
 * Mount once, app-wide. `unread` is optional: pass a source of truth if CardDesk
 * ever grows a real notification inbox; without one, foregrounding clears.
 */
export function useAppBadge(unread?: MaybeRefOrGetter<number>) {
  if (!import.meta.client) return

  const read = () => (unread === undefined ? 0 : Math.max(0, Math.floor(toValue(unread) || 0)))

  if (unread !== undefined) watch(() => toValue(unread), () => setAppBadge(read()), { immediate: true })

  onMounted(() => {
    const onForeground = () => {
      if (document.visibilityState !== 'visible') return
      setAppBadge(read())
    }
    onForeground()
    document.addEventListener('visibilitychange', onForeground)
    window.addEventListener('pageshow', onForeground)
    onUnmounted(() => {
      document.removeEventListener('visibilitychange', onForeground)
      window.removeEventListener('pageshow', onForeground)
    })
  })
}
