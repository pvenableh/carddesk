/**
 * Pure vCard 3.0 builders shared by the Vue app (single-contact share, QR) and
 * the Nitro server (batch export endpoint). Imported via `~/types/vcard` from
 * both contexts — same cross-import pattern as `~/types/socials`. No Vue/Nuxt
 * runtime here so it bundles safely on either side.
 */
import { SOCIALS, socialUrl } from '~/types/socials'
import type { ContactPhone } from '~/types/contact'

export interface ShareableContact {
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  title?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  /** Additional numbers beyond the primary `phone`. */
  phones?: { label?: string; value: string }[] | null
  website?: string | null
  notes?: string | null
  /** Social handles (linkedin, instagram, twitter, …) read dynamically via SOCIALS. */
  [key: string]: any
}

/** An optional embedded photo for the vCard (base64-encoded image bytes). */
export interface VCardPhoto {
  base64: string
  /** Image subtype as it appears after `TYPE=`, e.g. 'JPEG' | 'PNG'. */
  type: string
}

function vcardEscape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function fullName(c: ShareableContact): string {
  return (c.name || [c.first_name, c.last_name].filter(Boolean).join(' ')).trim() || 'Contact'
}

/** Build a vCard 3.0 (.vcf) string from a contact, optionally embedding a photo. */
export function buildVCard(c: ShareableContact, opts?: { photo?: VCardPhoto | null }): string {
  const first = c.first_name ?? ''
  const last = c.last_name ?? ''
  const full = fullName(c)
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${vcardEscape(last)};${vcardEscape(first)};;;`,
    `FN:${vcardEscape(full)}`,
  ]
  if (c.title) lines.push(`TITLE:${vcardEscape(c.title)}`)
  if (c.company) lines.push(`ORG:${vcardEscape(c.company)}`)
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(c.email)}`)
  if (c.phone) lines.push(`TEL;TYPE=CELL:${vcardEscape(c.phone)}`)
  if (Array.isArray(c.phones)) {
    for (const p of c.phones) {
      if (!p?.value) continue
      // Map a free-text label onto a vCard TYPE token (WORK, HOME, …); fall back
      // to a generic VOICE so the number still imports cleanly.
      const type = (p.label || '').trim().toUpperCase().replace(/[^A-Z]/g, '') || 'VOICE'
      lines.push(`TEL;TYPE=${type}:${vcardEscape(p.value)}`)
    }
  }
  if (c.website) lines.push(`URL:${vcardEscape(c.website)}`)
  for (const def of SOCIALS) {
    const v = c[def.key]
    if (v) lines.push(`URL;TYPE=${def.label}:${vcardEscape(socialUrl(def.key, v))}`)
  }
  if (c.notes) lines.push(`NOTE:${vcardEscape(c.notes)}`)
  if (opts?.photo?.base64) lines.push(`PHOTO;ENCODING=b;TYPE=${opts.photo.type}:${opts.photo.base64}`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

/**
 * Build one .vcf payload containing many cards. A single file with N VCARD
 * blocks imports as N contacts in Contacts.app / Google Contacts. `photos` is an
 * optional id→photo map keyed by `contact.id`.
 */
export function buildVCardBatch(
  contacts: ShareableContact[],
  photos?: Record<string, VCardPhoto | null>,
): string {
  return contacts
    .map((c) => buildVCard(c, { photo: photos?.[c.id as string] ?? null }))
    .join('\r\n')
}

// ───────────────────────── vCard parsing (import) ─────────────────────────
// The inbound counterpart to buildVCard: turn a raw .vcf payload (a single card
// or a batch of many) back into ShareableContacts the Add/Import flows can save.
// This is what lets us CAPTURE the contact cards people AirDrop / share at an
// event — iOS Contacts, Google Contacts, and the vCards other apps hand out are
// all vCard 3.0/4.0, which this understands.

/** Reverse of vcardEscape — turn the on-wire escapes back into literal chars. */
function vcardUnescape(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** Decode a quoted-printable value (older Outlook/Android exports use it). */
function decodeQuotedPrintable(v: string): string {
  const bytes: number[] = []
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '=' && i + 2 < v.length) {
      const hex = v.slice(i + 1, i + 3)
      if (/^[0-9a-f]{2}$/i.test(hex)) { bytes.push(parseInt(hex, 16)); i += 2; continue }
    }
    bytes.push(v.charCodeAt(i))
  }
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
  } catch {
    return v
  }
}

/** Split a vCard value on unescaped `;` into its structured components. */
function splitStructured(v: string): string[] {
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '\\') { cur += v[i] + (v[i + 1] ?? ''); i++; continue }
    if (v[i] === ';') { out.push(cur); cur = ''; continue }
    cur += v[i]
  }
  out.push(cur)
  return out
}

/** Map a URL to a known social platform key by hostname, or null if it's just
 *  a plain website. Mirrors the SOCIALS bases so detection stays in sync. */
function socialKeyForUrl(url: string): string | null {
  let host = ''
  try { host = new URL(url).hostname.replace(/^www\./, '').toLowerCase() }
  catch { return null }
  if (host.endsWith('linkedin.com')) return 'linkedin'
  if (host.endsWith('instagram.com')) return 'instagram'
  if (host === 'x.com' || host.endsWith('twitter.com')) return 'twitter'
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube'
  if (host.endsWith('behance.net')) return 'behance'
  return null
}

/** Friendly label for a TEL/EMAIL from its vCard TYPE params. */
function labelFromTypes(types: string[]): string {
  const t = types.map((x) => x.toUpperCase())
  if (t.includes('CELL') || t.includes('MOBILE')) return 'Mobile'
  if (t.includes('WORK')) return 'Work'
  if (t.includes('HOME')) return 'Home'
  if (t.includes('FAX')) return 'Fax'
  if (t.includes('MAIN')) return 'Main'
  return ''
}

interface VCardLine {
  /** Uppercased property name with any `group.` prefix stripped, e.g. 'TEL'. */
  name: string
  /** The group prefix if present (e.g. 'item1'), used to correlate X-ABLabel. */
  group: string
  /** Raw param tokens after the name, e.g. ['TYPE=CELL', 'PREF']. */
  params: string[]
  /** Decoded, unescaped value. */
  value: string
}

/** Parse one property line (`[group.]NAME;PARAM=x:value`) into its parts. */
function parseLine(line: string): VCardLine | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const head = line.slice(0, colon)
  let value = line.slice(colon + 1)
  const parts = head.split(';')
  let nameToken = parts[0] || ''
  const params = parts.slice(1)
  let group = ''
  const dot = nameToken.indexOf('.')
  if (dot !== -1) { group = nameToken.slice(0, dot); nameToken = nameToken.slice(dot + 1) }

  // Decode before unescaping so QP byte sequences resolve to real chars first.
  const enc = params.find((p) => /^ENCODING=/i.test(p))?.split('=')[1]?.toUpperCase()
  if (enc === 'QUOTED-PRINTABLE') value = decodeQuotedPrintable(value)
  return { name: nameToken.toUpperCase(), group, params, value }
}

/** Pull the TYPE=... tokens (and bare type params) off a line. */
function typesOf(l: VCardLine): string[] {
  const out: string[] = []
  for (const p of l.params) {
    const m = p.match(/^TYPE=(.+)$/i)
    if (m) out.push(...m[1].split(',').map((s) => s.trim()))
    else if (!/^[A-Z-]+=/i.test(p)) out.push(p.trim()) // bare param, e.g. vCard 2.1 `;CELL`
  }
  return out
}

/**
 * Parse a .vcf payload into ShareableContacts. Accepts a single card or a batch
 * (many BEGIN/END blocks in one file — the shape buildVCardBatch emits and the
 * shape you get exporting several contacts from a phone). Unparseable/empty
 * cards are skipped; the caller decides which of the rest to actually save.
 */
export function parseVCards(text: string): ShareableContact[] {
  if (!text) return []
  // 1) Unfold RFC-6350 line folding: a leading space/tab continues the prior line.
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '')
  const lines = unfolded.split('\n')

  const cards: ShareableContact[] = []
  let block: VCardLine[] | null = null
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^BEGIN:VCARD$/i.test(line)) { block = []; continue }
    if (/^END:VCARD$/i.test(line)) {
      if (block) { const c = blockToContact(block); if (c) cards.push(c) }
      block = null
      continue
    }
    if (block && line) { const l = parseLine(line); if (l) block.push(l) }
  }
  return cards
}

/** Turn one card's parsed lines into a ShareableContact. */
function blockToContact(lines: VCardLine[]): ShareableContact | null {
  const c: ShareableContact = {
    name: '', first_name: null, last_name: null, title: null, company: null,
    email: null, phone: null, phones: [], website: null, notes: null,
  }
  const extraPhones: ContactPhone[] = []
  // item-group → its X-ABLabel, so grouped URLs (item1.URL + item1.X-ABLabel)
  // can be labelled (iOS uses this for named links).
  const groupLabels = new Map<string, string>()
  for (const l of lines) {
    if (l.name === 'X-ABLABEL' && l.group) groupLabels.set(l.group, vcardUnescape(l.value))
  }

  for (const l of lines) {
    const val = vcardUnescape(l.value).trim()
    switch (l.name) {
      case 'N': {
        const [last, first] = splitStructured(l.value).map((s) => vcardUnescape(s).trim())
        if (first) c.first_name = first
        if (last) c.last_name = last
        break
      }
      case 'FN':
        if (val) c.name = val
        break
      case 'ORG':
        if (!c.company) c.company = splitStructured(l.value).map((s) => vcardUnescape(s).trim()).filter(Boolean)[0] || null
        break
      case 'TITLE':
        if (!c.title && val) c.title = val
        break
      case 'EMAIL':
        // Single email on the model — keep the first (prefer a PREF-tagged one).
        if (!c.email && val) c.email = val
        else if (val && typesOf(l).map((t) => t.toUpperCase()).includes('PREF')) c.email = val
        break
      case 'TEL': {
        if (!val) break
        if (!c.phone) c.phone = val
        else {
          const label = labelFromTypes(typesOf(l))
          extraPhones.push(label ? { label, value: val } : { value: val })
        }
        break
      }
      case 'URL': {
        if (!val) break
        const key = socialKeyForUrl(val)
        if (key) { if (!c[key]) c[key] = val }
        else if (!c.website) c.website = val
        break
      }
      case 'X-SOCIALPROFILE':
      case 'IMPP': {
        // e.g. X-SOCIALPROFILE;TYPE=linkedin:https://…  /  impp:x-apple:…
        if (!val) break
        const type = typesOf(l)[0]?.toLowerCase()
        const key = (type && SOCIALS.some((s) => s.key === type) ? type : socialKeyForUrl(val)) || null
        if (key && !c[key]) c[key] = val
        break
      }
      case 'NOTE':
        if (!c.notes && val) c.notes = val
        break
    }
  }

  if (extraPhones.length) c.phones = extraPhones
  // Fall back to the structured name, then company, for the display/save name.
  if (!c.name) c.name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.company || ''
  // A card with nothing usable (no name and no way to reach them) is noise.
  if (!c.name && !c.email && !c.phone) return null
  if (!c.name) c.name = 'Unnamed contact'
  return c
}
