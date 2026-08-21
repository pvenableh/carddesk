/**
 * Keep the app shell's height honest — `--cd-app-h`, re-measured from JS.
 *
 * `.cd-root` is `height: 100dvh` and a flex column: header, screens (`flex: 1`),
 * bottom nav. That's correct right up until a browser hands out a stale viewport
 * height and never corrects it — at which point `flex: 1` resolves to nothing
 * and the nav rides up to the top of the screen with the content squeezed out
 * behind it.
 *
 * iOS Chrome does exactly that after granting camera access: the WKWebView is
 * resized around its permission prompt, and the dynamic viewport units settle on
 * the prompt-sized value instead of the restored one. CSS alone can't recover,
 * because as far as the engine is concerned `dvh` is already up to date.
 *
 * So the height gets re-asserted from `window.innerHeight` on every event that
 * could mean the viewport moved. Same value as `100dvh` in the normal case —
 * the point isn't a different number, it's having something that re-measures
 * when the browser forgets to. The `100dvh` fallback in the CSS still applies
 * before this runs and if a measurement is ever refused.
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  let pending: ReturnType<typeof setTimeout> | null = null

  function measure() {
    // The larger of the two on purpose. `innerHeight` ignores the on-screen
    // keyboard, which must not resize the app shell; `visualViewport.height` is
    // live and stays correct when the layout viewport is the thing that got
    // stuck. Taking the max means each covers the other's failure.
    const h = Math.max(window.innerHeight || 0, window.visualViewport?.height || 0)
    // A viewport this small is a browser mid-transition, not a real window.
    // Writing it would cause the very collapse this exists to prevent.
    if (!h || h < 200) return
    document.documentElement.style.setProperty('--cd-app-h', `${h}px`)
  }

  /**
   * Coalesce the bursts of events a toolbar animation produces.
   *
   * Deliberately a timer and not `requestAnimationFrame`: rAF doesn't run in a
   * backgrounded tab, and a page sitting behind a permission prompt is exactly
   * a backgrounded tab. Caught this live — with rAF, every correction after the
   * first was silently dropped in a hidden tab, which is the one case this whole
   * plugin exists for.
   */
  function schedule() {
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      measure()
    }, 60)
  }

  measure()
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
  window.addEventListener('pageshow', schedule)
  // Returning from a permission prompt or the app switcher is precisely when a
  // stale height needs correcting.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule() })
  // Fires on toolbar collapse and keyboard show/hide. We read innerHeight rather
  // than visualViewport.height on purpose: the keyboard must not resize the app
  // shell, only give us another chance to notice a bad layout.
  window.visualViewport?.addEventListener('resize', schedule)
  // The backstop: some viewport changes never fire a resize event at all (a
  // webview resized out from under the page — verified here, where changing the
  // viewport updated innerHeight without dispatching anything).
  //
  // It watches an invisible fixed probe rather than <html>, whose box tracks
  // page *content*, not the viewport. A `position: fixed; inset: 0` element is
  // sized by the viewport by definition, so its box changes exactly when the
  // thing we care about does.
  try {
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;inset:0;pointer-events:none;visibility:hidden;z-index:-1;contain:strict'
    document.body?.appendChild(probe)
    if (probe.isConnected) new ResizeObserver(schedule).observe(probe)
  } catch {
    /* pre-ResizeObserver browsers keep the event listeners above */
  }
})
