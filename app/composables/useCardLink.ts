/**
 * Client side of "someone handed me a code/link instead of a card".
 *
 * Anything self-contained (a vCard or MECARD encoded straight into the QR, a
 * tel:/mailto:) is turned into a contact right here — no round trip, so it
 * works on conference wifi that has given up. Everything else is a link to a
 * card hosted elsewhere, which only the server can safely chase; see
 * server/api/resolve-card-link.post.ts.
 */
import { classifyCardPayload } from '~/types/card-link'
import type { ShareableContact } from '~/types/vcard'

export interface ResolvedCard {
  contacts: ShareableContact[]
  source: 'vcard' | 'mecard' | 'contact-uri' | 'carddesk' | 'linked-vcard' | 'ai'
  url: string | null
  /** Whether resolving this cost an AI credit. */
  charged: boolean
}

export function useCardLink() {
  const resolving = ref(false)

  /** True when the payload can be turned into a contact without the network —
   *  the scan screen uses this to take the code silently instead of asking. */
  function isSelfContained(payload: string): boolean {
    return classifyCardPayload(payload).contacts.length > 0
  }

  /**
   * Resolve a scanned QR payload or a pasted/shared link into contacts.
   * Throws an Error with a user-facing message on failure.
   */
  async function resolve(payload: string): Promise<ResolvedCard> {
    const trimmed = (payload || '').trim()
    if (!trimmed) throw new Error("There's nothing to import there.")

    const local = classifyCardPayload(trimmed)
    if (local.contacts.length)
      return { contacts: local.contacts, source: local.kind as ResolvedCard['source'], url: null, charged: false }
    if (local.kind !== 'url')
      throw new Error("That code isn't a contact card — it didn't contain contact details or a link.")

    resolving.value = true
    try {
      const res = await $fetch<ResolvedCard>('/api/resolve-card-link', {
        method: 'POST',
        body: { payload: trimmed },
      })
      if (!res.contacts?.length) throw new Error("We couldn't find a contact on that page.")
      return res
    } catch (err: any) {
      // A network failure has no HTTP status — say so plainly instead of
      // showing the generic "couldn't read that page".
      if (import.meta.client && !navigator.onLine)
        throw new Error("No connection — reading that link needs one. The card's link is safe to try again later.")
      throw new Error(err?.data?.message || err?.message || "We couldn't read that card link.")
    } finally {
      resolving.value = false
    }
  }

  return { resolve, isSelfContained, resolving }
}
