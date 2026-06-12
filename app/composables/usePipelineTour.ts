/**
 * Lightweight first-run coachmark for the pipeline view. The "seen" flag lives
 * in localStorage (per-device, one-time) — a coachmark doesn't warrant a server
 * round-trip or a schema column. Bump the version suffix to re-show it to
 * everyone after a meaningful pipeline change.
 */
const SEEN_KEY = 'cd_pipeline_tour_seen_v1'

export function usePipelineTour() {
  const open = useState('cd_pipeline_tour_open', () => false)

  function hasSeen() {
    if (!import.meta.client) return true
    try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
  }

  function markSeen() {
    if (!import.meta.client) return
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode — show again, no harm */ }
  }

  /** Auto-start once, the first time the pipeline view is opened. */
  function maybeAutoStart() {
    if (!hasSeen()) open.value = true
  }

  /** Replay on demand (e.g. a "How it works" link). */
  function startTour() { open.value = true }

  function finish() {
    open.value = false
    markSeen()
  }

  return { open, maybeAutoStart, startTour, finish }
}
