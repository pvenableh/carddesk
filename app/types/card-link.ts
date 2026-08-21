/**
 * QR / shared-payload classification — the front door for cards that arrive as
 * a *code* rather than a file. Whatever a scan or a share hands us (a raw
 * vCard, a MECARD string, a link to someone's digital card on another service,
 * a bare tel:/mailto:), this decides what it is and, where it can be done
 * without a network call, turns it straight into ShareableContacts.
 *
 * Pure — no Vue, no Nitro — so the client (QR decode) and the server
 * (link resolution) classify identically. Same cross-import pattern as
 * `~/types/vcard`.
 */
import { parseVCards, type ShareableContact } from '~/types/vcard'

export type CardPayloadKind =
  /** A full vCard was embedded in the code — nothing to fetch. */
  | 'vcard'
  /** MECARD (the compact contact format Android/Japanese QR cards use). */
  | 'mecard'
  /** A link to a card hosted somewhere — needs server-side resolution. */
  | 'url'
  /** A bare tel:/mailto:/sms: — thin, but enough to start a contact. */
  | 'contact-uri'
  /** Something we can't turn into a person. */
  | 'unknown'

/**
 * Why a scanned code / shared link didn't become a contact. The scan screen
 * turns these into different feedback: a QR that points at a company website
 * is a perfectly good QR pointing at the wrong thing (offer to keep the URL and
 * read the printed card instead), while a dead link is just broken. Neither is
 * a scan worth celebrating, so neither earns XP or confetti.
 */
export type CardLinkFailReason =
  /** The code carried neither contact details nor a link (a wifi/menu QR). */
  | 'not-a-card'
  /** A link, but nothing answered: dead host, blocked, timed out, 404. */
  | 'unreachable'
  /** The page loaded fine — it's a website, not anyone's digital card. */
  | 'website'
  /** Card-shaped page, but no contact details we could pull off it. */
  | 'no-details'
  /** A CardDesk card link whose card has since been deleted. */
  | 'missing-card'
  /** Client-side only: reading the link needs a connection we don't have. */
  | 'offline'

export interface ClassifiedPayload {
  kind: CardPayloadKind
  /** Contacts we could extract offline (vcard / mecard / contact-uri). */
  contacts: ShareableContact[]
  /** The URL to resolve when kind === 'url'. */
  url: string | null
  /** The original payload, trimmed. */
  raw: string
}

/** Pull the first http(s) URL out of a blob of text (share payloads often
 *  arrive as "Check out my card https://…" rather than a bare link). */
export function firstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')\]]+/i)
  if (!m) return null
  // Trailing punctuation from prose ("…/card.") isn't part of the URL.
  return m[0].replace(/[.,;:!]+$/, '')
}

/**
 * Parse a MECARD payload: `MECARD:N:Doe,John;TEL:555…;EMAIL:a@b.co;;`
 * Fields are `KEY:value` pairs separated by unescaped semicolons.
 */
export function parseMeCard(text: string): ShareableContact | null {
  const body = text.replace(/^MECARD:/i, '')
  const c: ShareableContact = {
    name: '', first_name: null, last_name: null, title: null, company: null,
    email: null, phone: null, phones: [], website: null, notes: null,
  }
  const extraPhones: { label?: string; value: string }[] = []

  // Split on unescaped `;` (MECARD escapes with a backslash).
  const fields: string[] = []
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '\\') { cur += body[i + 1] ?? ''; i++; continue }
    if (body[i] === ';') { fields.push(cur); cur = ''; continue }
    cur += body[i]
  }
  fields.push(cur)

  for (const f of fields) {
    const colon = f.indexOf(':')
    if (colon === -1) continue
    const key = f.slice(0, colon).trim().toUpperCase()
    const val = f.slice(colon + 1).trim()
    if (!val) continue
    switch (key) {
      case 'N': {
        // `N:Last,First` — a single token is a full name.
        const [last, first] = val.split(',').map((s) => s.trim())
        if (first) { c.first_name = first; c.last_name = last || null }
        else c.name = last
        break
      }
      case 'NICKNAME':
        if (!c.name) c.name = val
        break
      case 'TEL':
      case 'TEL-AV':
        if (!c.phone) c.phone = val
        else extraPhones.push({ value: val })
        break
      case 'EMAIL':
        if (!c.email) c.email = val
        break
      case 'ORG':
        c.company = val
        break
      case 'TITLE':
        c.title = val
        break
      case 'URL':
        if (!c.website) c.website = val
        break
      case 'ADR':
        c.address = val.split(',').filter(Boolean).join(', ')
        break
      case 'NOTE':
        c.notes = val
        break
    }
  }

  if (extraPhones.length) c.phones = extraPhones
  if (!c.name) c.name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company || ''
  if (!c.name && !c.email && !c.phone) return null
  if (!c.name) c.name = 'Unnamed contact'
  return c
}

/** Turn a `tel:` / `mailto:` / `sms:` URI into a (thin) contact. */
function parseContactUri(text: string): ShareableContact | null {
  const lower = text.toLowerCase()
  if (lower.startsWith('mailto:')) {
    const email = text.slice(7).split('?')[0].trim()
    if (!email) return null
    // A name is often encoded in the local part ("jane.doe@…") — a decent
    // starting guess the user can correct before saving.
    const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
    const parts = local.split(/\s+/).filter(Boolean)
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    return {
      name: parts.length > 1 ? parts.map(cap).join(' ') : cap(local),
      first_name: parts.length > 1 ? cap(parts[0]) : null,
      last_name: parts.length > 1 ? cap(parts[parts.length - 1]) : null,
      email,
      phone: null, title: null, company: null, website: null, notes: null, phones: [],
    }
  }
  if (lower.startsWith('tel:') || lower.startsWith('sms:')) {
    const phone = decodeURIComponent(text.slice(4).split('?')[0]).trim()
    if (!phone) return null
    return {
      name: '', first_name: null, last_name: null, title: null, company: null,
      email: null, phone, phones: [], website: null, notes: null,
    }
  }
  return null
}

/**
 * Classify a scanned/shared payload and extract whatever can be had offline.
 * Anything that needs the network (a link to a hosted card) comes back as
 * `kind: 'url'` for `/api/resolve-card-link` to chase down.
 */
export function classifyCardPayload(input: string): ClassifiedPayload {
  const raw = (input || '').trim()
  const empty: ClassifiedPayload = { kind: 'unknown', contacts: [], url: null, raw }
  if (!raw) return empty

  if (/BEGIN:VCARD/i.test(raw)) {
    const contacts = parseVCards(raw)
    if (contacts.length) return { kind: 'vcard', contacts, url: null, raw }
    // A malformed vCard may still carry a link worth chasing.
  }

  if (/^MECARD:/i.test(raw)) {
    const c = parseMeCard(raw)
    if (c) return { kind: 'mecard', contacts: [c], url: null, raw }
  }

  if (/^(tel|sms|mailto):/i.test(raw)) {
    const c = parseContactUri(raw)
    if (c) return { kind: 'contact-uri', contacts: [c], url: null, raw }
  }

  const url = firstUrl(raw)
  if (url) return { kind: 'url', contacts: [], url, raw }

  return empty
}
