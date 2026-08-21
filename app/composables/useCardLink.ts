/**
 * Client side of "someone handed me a code/link instead of a card".
 *
 * Anything self-contained (a vCard or MECARD encoded straight into the QR, a
 * tel:/mailto:) is turned into a contact right here — no round trip, so it
 * works on conference wifi that has given up. Everything else is a link to a
 * card hosted elsewhere, which only the server can safely chase; see
 * server/api/resolve-card-link.post.ts.
 */
import { classifyCardPayload, type CardLinkFailReason } from '~/types/card-link'
import type { ShareableContact } from '~/types/vcard'

/**
 * A resolve that didn't produce a contact, with the *reason* attached. Callers
 * that only want to say something ("couldn't read that") can still read
 * `.message`; the scan screen branches on `.reason` to offer the right way out
 * — a company website is worth keeping as a website, a dead link isn't.
 */
export class CardLinkError extends Error {
  reason: CardLinkFailReason
  /** The link we ended up at (after redirects), when there was one. */
  url: string | null
  /** A short human label for the page — a company or site name. */
  siteName: string | null
  constructor(
    message: string,
    reason: CardLinkFailReason,
    extra: { url?: string | null; siteName?: string | null } = {},
  ) {
    super(message)
    this.name = 'CardLinkError'
    this.reason = reason
    this.url = extra.url ?? null
    this.siteName = extra.siteName ?? null
  }
}

export interface ResolvedCard {
  contacts: ShareableContact[]
  source: 'vcard' | 'mecard' | 'contact-uri' | 'carddesk' | 'linked-vcard' | 'ai'
  url: string | null
  /** Whether resolving this cost an AI credit. */
  charged: boolean
}

export function useCardLink() {
  const resolving = ref(false)

  /** The link a code points at, or null when it isn't a link at all (a wifi
   *  or menu QR). The scan screen only offers to follow real links. */
  function linkTarget(payload: string): string | null {
    return classifyCardPayload(payload).url
  }

  /** The contact a self-contained code carries, when it names an actual person.
   *  This is the one case worth taking without asking — exact, free, complete —
   *  so a code that only yields a company doesn't get to pre-empt the photos. */
  function selfContainedCard(payload: string): ShareableContact | null {
    const card = classifyCardPayload(payload).contacts[0]
    if (!card) return null
    const named = card.first_name || card.last_name || card.name || card.email || card.phone
    return named ? card : null
  }

  /**
   * Resolve a scanned QR payload or a pasted/shared link into contacts.
   * Throws an Error with a user-facing message on failure.
   */
  async function resolve(payload: string): Promise<ResolvedCard> {
    const trimmed = (payload || '').trim()
    if (!trimmed) throw new CardLinkError("There's nothing to import there.", 'not-a-card')

    const local = classifyCardPayload(trimmed)
    if (local.contacts.length)
      return { contacts: local.contacts, source: local.kind as ResolvedCard['source'], url: null, charged: false }
    if (local.kind !== 'url')
      throw new CardLinkError(
        "That code isn't a contact card — it didn't contain contact details or a link.",
        'not-a-card',
      )

    resolving.value = true
    try {
      const res = await $fetch<ResolvedCard>('/api/resolve-card-link', {
        method: 'POST',
        body: { payload: trimmed },
      })
      if (!res.contacts?.length)
        throw new CardLinkError("We couldn't find a contact on that page.", 'no-details', { url: local.url })
      return res
    } catch (err: any) {
      if (err instanceof CardLinkError) throw err
      // A network failure has no HTTP status — say so plainly instead of
      // showing the generic "couldn't read that page".
      if (import.meta.client && !navigator.onLine)
        throw new CardLinkError(
          "No connection — reading that link needs one. The card's link is safe to try again later.",
          'offline',
          { url: local.url },
        )
      // `err.data` is the error body Nitro sent; its own `data` carries the
      // reason we attached server-side (see cardLinkError there).
      const detail = err?.data?.data ?? {}
      throw new CardLinkError(
        err?.data?.message || err?.message || "We couldn't read that card link.",
        detail.reason ?? 'no-details',
        { url: detail.url ?? local.url, siteName: detail.siteName ?? null },
      )
    } finally {
      resolving.value = false
    }
  }

  return { resolve, selfContainedCard, linkTarget, resolving }
}
