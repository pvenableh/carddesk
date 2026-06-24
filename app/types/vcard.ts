/**
 * Pure vCard 3.0 builders shared by the Vue app (single-contact share, QR) and
 * the Nitro server (batch export endpoint). Imported via `~/types/vcard` from
 * both contexts — same cross-import pattern as `~/types/socials`. No Vue/Nuxt
 * runtime here so it bundles safely on either side.
 */
import { SOCIALS, socialUrl } from '~/types/socials'

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
