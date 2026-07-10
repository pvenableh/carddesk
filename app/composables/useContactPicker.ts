import type { ShareableContact } from '~/types/vcard'

/**
 * Contact Picker API wrapper — lets the user pick people straight from their
 * phone's address book into CardDesk, no file juggling. This is the natural
 * capture path for contacts that arrived "outside" CardDesk (someone AirDropped
 * or QR-shared their info and it saved into the phone's Contacts): they're
 * already on the device, so we just pull them in.
 *
 * Support is the catch: the Contact Picker API is Chrome-on-Android only. iOS
 * Safari has never shipped it (nor a Web Share Target), so on iPhone this is
 * unavailable and the Import screen falls back to the .vcf export→import flow.
 * Always feature-detect via `supported` before showing the entry point.
 *
 * The API only exposes name/email/tel/address/icon — no company/title/URL — so
 * imported contacts carry the essentials; the rest can be filled in later.
 */
export function useContactPicker() {
  const supported = computed(
    () =>
      import.meta.client &&
      'contacts' in navigator &&
      'ContactsManager' in window &&
      typeof (navigator as any).contacts?.select === 'function',
  )

  function mapContact(c: any): ShareableContact | null {
    const name = ((Array.isArray(c.name) ? c.name[0] : c.name) || '').trim()
    const emails: string[] = Array.isArray(c.email) ? c.email.filter(Boolean) : []
    const tels: string[] = Array.isArray(c.tel) ? c.tel.filter(Boolean) : []
    const parts = name.split(/\s+/).filter(Boolean)
    const contact: ShareableContact = {
      name,
      first_name: parts.length ? parts[0] : null,
      last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
      title: null,
      company: null,
      email: emails[0] || null,
      phone: tels[0] || null,
      // Extra numbers become labelled-less phones[] — the picker gives no types.
      phones: tels.slice(1).map((value) => ({ value })),
      website: null,
      notes: null,
    }
    if (!contact.name && !contact.email && !contact.phone) return null
    if (!contact.name) contact.name = 'Unnamed contact'
    return contact
  }

  /**
   * Open the OS contact picker (multi-select) and return the chosen people as
   * ShareableContacts. Resolves to [] on cancel or when unsupported — a no-op,
   * not an error, so callers stay quiet.
   */
  async function pick(): Promise<ShareableContact[]> {
    if (!supported.value) return []
    // Only request properties the platform actually supports, or select() throws.
    let props = ['name', 'email', 'tel']
    try {
      const avail: string[] = await (navigator as any).contacts.getProperties()
      if (Array.isArray(avail) && avail.length) props = props.filter((p) => avail.includes(p))
    } catch {
      // getProperties missing/failed — fall back to the standard three.
    }
    if (!props.length) return []
    try {
      const selected: any[] = await (navigator as any).contacts.select(props, { multiple: true })
      return (selected || []).map(mapContact).filter(Boolean) as ShareableContact[]
    } catch (err) {
      // A rejection here is a user cancel or an unavailable picker — treat as [].
      console.error('[contact-picker]', err)
      return []
    }
  }

  return { supported, pick }
}
