/**
 * Native sharing helpers built on the Web Share API — tuned for iPhone, where
 * navigator.share() opens the system share sheet (Messages, AirDrop, Mail,
 * "Add to Contacts" for .vcf files, etc.).
 *
 * Every helper degrades gracefully: if the Web Share API (or file sharing)
 * isn't available — e.g. desktop Chrome — it falls back to a clipboard copy or
 * a file download so nothing is a dead end.
 */
export interface ShareableContact {
  name?: string | null
  first_name?: string | null
  last_name?: string | null
  title?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  linkedin?: string | null
  notes?: string | null
}

function vcardEscape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Build a vCard 3.0 (.vcf) string from a contact. */
export function buildVCard(c: ShareableContact): string {
  const first = c.first_name ?? ''
  const last = c.last_name ?? ''
  const full = (c.name || [first, last].filter(Boolean).join(' ')).trim() || 'Contact'
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
  if (c.website) lines.push(`URL:${vcardEscape(c.website)}`)
  if (c.linkedin) lines.push(`URL;TYPE=LinkedIn:${vcardEscape(c.linkedin)}`)
  if (c.notes) lines.push(`NOTE:${vcardEscape(c.notes)}`)
  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export function useShare() {
  const supported = computed(() => import.meta.client && typeof navigator !== 'undefined' && !!navigator.share)

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /**
   * Share a contact as a .vcf via the share sheet (iPhone → "Add to Contacts").
   * Returns 'shared' | 'downloaded' | 'cancelled'.
   */
  async function shareContact(c: ShareableContact): Promise<'shared' | 'downloaded' | 'cancelled'> {
    const vcf = buildVCard(c)
    const full = (c.name || [c.first_name, c.last_name].filter(Boolean).join(' ')).trim() || 'contact'
    const filename = `${full.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.vcf`

    if (import.meta.client && navigator.canShare) {
      try {
        const file = new File([vcf], filename, { type: 'text/vcard' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: full })
          return 'shared'
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'cancelled'
        // fall through to download
      }
    }
    downloadFile(filename, vcf, 'text/vcard')
    return 'downloaded'
  }

  /**
   * Share a URL (invite link, profile) via the share sheet.
   * Returns 'shared' | 'copied' | 'cancelled'.
   */
  async function shareUrl(opts: { url: string; title?: string; text?: string }): Promise<'shared' | 'copied' | 'cancelled'> {
    if (supported.value) {
      try {
        await navigator.share({ url: opts.url, title: opts.title, text: opts.text })
        return 'shared'
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'cancelled'
      }
    }
    const ok = await copyToClipboard(opts.url)
    return ok ? 'copied' : 'cancelled'
  }

  return { supported, shareContact, shareUrl, buildVCard }
}
