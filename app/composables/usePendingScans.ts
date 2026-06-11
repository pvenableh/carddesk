/**
 * Offline scan safety net. Scanning happens exactly where wifi is worst — a
 * conference floor — so a captured card must never be lost to a dead
 * connection. When the scan API call fails on a network error, the (already
 * downscaled) images are stashed here; the scan screen shows a "waiting to
 * process" banner and the user replays them with one tap once they're back
 * online. Persisted in localStorage, capped so we stay well under quota
 * (~0.5MB per two-sided card).
 */
export interface PendingScan {
  id: string
  images: { data: string; mediaType: string }[]
  /** Event name to restore into "Where We Met" if it was captured in Event Mode. */
  metAt: string | null
  savedAt: string
}

const KEY = 'cd_pending_scans'
export const MAX_PENDING_SCANS = 5

export function usePendingScans() {
  const pending = useState<PendingScan[]>('cd-pending-scans', () => [])

  /** Load the stash from localStorage — call once on app mount. */
  function hydrate() {
    if (!import.meta.client) return
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
      if (Array.isArray(raw)) pending.value = raw
    } catch { pending.value = [] }
  }

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(KEY, JSON.stringify(pending.value))
    } catch {
      // Quota hit — keep only the newest two cards rather than losing the write.
      try {
        pending.value = pending.value.slice(-2)
        localStorage.setItem(KEY, JSON.stringify(pending.value))
      } catch { /* storage unavailable — stash lives in memory for this session */ }
    }
  }

  /** Stash a failed capture. Returns false when the queue is full. */
  function stash(images: { data: string; mediaType: string }[], metAt: string | null): boolean {
    if (pending.value.length >= MAX_PENDING_SCANS) return false
    pending.value = [...pending.value, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      images,
      metAt,
      savedAt: new Date().toISOString(),
    }]
    persist()
    return true
  }

  function remove(id: string) {
    pending.value = pending.value.filter((p) => p.id !== id)
    persist()
  }

  return { pending, hydrate, stash, remove }
}
