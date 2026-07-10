import type { ShareableContact } from '~/types/vcard'

/**
 * A one-shot handoff slot for contacts that arrived via the Web Share Target
 * (someone shared a `.vcf` straight into CardDesk on a platform that supports
 * it). The service worker stashes the shared payload; the app reads it on load,
 * parses it, drops the cards here, and routes to the Import screen — which
 * `take()`s them exactly once so a refresh doesn't re-import.
 */
export function usePendingImport() {
  const cards = useState<ShareableContact[]>('cd-pending-import', () => [])

  function set(next: ShareableContact[]) {
    cards.value = next
  }

  /** Read and clear the pending cards (consume-once). */
  function take(): ShareableContact[] {
    const out = cards.value
    cards.value = []
    return out
  }

  return { cards, set, take }
}
