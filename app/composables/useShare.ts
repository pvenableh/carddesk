/**
 * Native sharing helpers built on the Web Share API — tuned for iPhone, where
 * navigator.share() opens the system share sheet (Messages, AirDrop, Mail,
 * "Add to Contacts" for .vcf files, etc.).
 *
 * Every helper degrades gracefully: if the Web Share API (or file sharing)
 * isn't available — e.g. desktop Chrome — it falls back to a clipboard copy or
 * a file download so nothing is a dead end.
 */
// vCard builders live in ~/types/vcard so the Nitro server (batch export) can
// share them. Re-exported here so existing callers (DetailScreen, c/[id].vue)
// keep importing { buildVCard } from this composable unchanged.
import { buildVCard, fullName, type ShareableContact } from '~/types/vcard'
export { buildVCard }
export type { ShareableContact }

export function useShare() {
  const analytics = useAnalytics()
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
    const full = fullName(c)
    const filename = `${full.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.vcf`

    if (import.meta.client && navigator.canShare) {
      try {
        const file = new File([vcf], filename, { type: 'text/vcard' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: full })
          analytics.share('contact', 'native')
          return 'shared'
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'cancelled'
        // fall through to download
      }
    }
    downloadFile(filename, vcf, 'text/vcard')
    analytics.share('contact', 'download')
    return 'downloaded'
  }

  /**
   * Share a prebuilt .vcf payload (e.g. a batch export of many contacts) through
   * the share sheet → iPhone "Add to Contacts"; falls back to a file download.
   * Returns 'shared' | 'downloaded' | 'cancelled'.
   */
  async function shareVcf(filename: string, vcf: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
    if (import.meta.client && navigator.canShare) {
      try {
        const file = new File([vcf], filename, { type: 'text/vcard' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] })
          analytics.share('contacts-batch', 'native')
          return 'shared'
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'cancelled'
        // fall through to download
      }
    }
    downloadFile(filename, vcf, 'text/vcard')
    analytics.share('contacts-batch', 'download')
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
        analytics.share('url', 'native')
        return 'shared'
      } catch (err: any) {
        if (err?.name === 'AbortError') return 'cancelled'
      }
    }
    const ok = await copyToClipboard(opts.url)
    if (ok) analytics.share('url', 'clipboard')
    return ok ? 'copied' : 'cancelled'
  }

  return { supported, shareContact, shareVcf, shareUrl, buildVCard }
}
