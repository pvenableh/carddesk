/**
 * Pure contact helpers shared by the Vue app and the Nitro server (imported via
 * `~/types/contact` from both). Same cross-context pattern as `~/types/socials`
 * and `~/types/vcard` — no Vue/Nuxt runtime here, so it bundles on either side.
 */

/** A labelled phone number. The primary number lives on `CdContact.phone`;
 *  these are the extras a contact can carry (work, home, assistant, …). */
export interface ContactPhone {
  label?: string
  value: string
}

/** Drop blank rows and trim a `phones` array before saving. Returns `null` when
 *  nothing's left, so we store null rather than an empty array. Shared by the
 *  forms and the create endpoint so the stored shape is always consistent. */
export function cleanPhones(phones: unknown): ContactPhone[] | null {
  if (!Array.isArray(phones)) return null
  const out = phones
    .filter((p): p is ContactPhone => !!p && typeof p.value === 'string' && p.value.trim() !== '')
    .map((p) => {
      const label = (p.label ?? '').trim()
      return label ? { label, value: p.value.trim() } : { value: p.value.trim() }
    })
  return out.length ? out : null
}
