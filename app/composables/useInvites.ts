/**
 * Invites — two ways to bring someone in:
 *  - sendInvite(contactId): a CONTACT-TARGETED email (deterministic source link
 *    on join + referral credit). Returns { sent, url } so the UI can fall back to
 *    copy/share if SendGrid is down.
 *  - link(): the user's evergreen generic share link (the existing /i/{code}),
 *    for QR / native share / copy.
 */
export interface SendInviteResult {
  sent: boolean
  reason: string | null
  url: string
  code: string
  email: string
}

export interface ContactInviteLink {
  sent: false
  url: string
  code: string
  email: string | null
  phone: string | null
  name: string | null
  firstName: string | null
  linked_user: string | null
}

export function useInvites() {
  async function sendInvite(contactId: string, note?: string) {
    return await $fetch<SendInviteResult>('/api/invite/send', {
      method: 'POST',
      body: { contactId, note: note ?? null },
    })
  }

  /** Mint (or reuse) a contact-targeted invite link WITHOUT sending an email —
   *  for QR / share / mailto / sms the user sends themselves. */
  async function mintContactInvite(contactId: string) {
    return await $fetch<ContactInviteLink>('/api/invite/send', {
      method: 'POST',
      body: { contactId, send: false },
    })
  }

  async function link() {
    return await $fetch<{ code: string; url: string }>('/api/invite')
  }

  /** Native share sheet where available, else copy to clipboard. Returns how it went. */
  async function share(url: string, text?: string): Promise<'shared' | 'copied' | 'failed'> {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: 'Join me on CardDesk', text: text || 'Join me on CardDesk', url })
        return 'shared'
      }
      await navigator.clipboard.writeText(url)
      return 'copied'
    } catch {
      return 'failed'
    }
  }

  return { sendInvite, mintContactInvite, link, share }
}
