import { parseVCards, type ShareableContact } from '~/types/vcard'

/**
 * vCard import — the inbound side of contact sharing. At an event people hand
 * out their contact card via AirDrop, a QR/digital scan, or a message; whatever
 * the channel, what lands on your phone is a `.vcf` (vCard). This composable
 * lets the user pick those files and turns them into ShareableContacts the
 * Import screen previews and saves.
 *
 * We can't silently intercept an AirDrop (no web API, and iOS Safari has no
 * share-target) — so the reliable, cross-platform capture is: receive the card,
 * then import the file here. On platforms that DO support Web Share Target
 * (Android/desktop Chrome) the manifest also routes shared cards straight in;
 * see `usePendingImport` for that hand-off.
 */
export function useVCardImport() {
  /** Read + parse many `.vcf` files into one combined contact list. */
  async function parseFiles(files: File[] | FileList): Promise<ShareableContact[]> {
    const list = Array.from(files)
    const out: ShareableContact[] = []
    for (const f of list) {
      try {
        const text = await f.text()
        out.push(...parseVCards(text))
      } catch (err) {
        console.error('[vcard-import] Failed to read file:', f.name, err)
      }
    }
    return out
  }

  /** Parse a raw payload (used by the Web Share Target hand-off). */
  function parseText(text: string): ShareableContact[] {
    return parseVCards(text)
  }

  /**
   * Open the native file picker for `.vcf` files and return the parsed cards.
   * Resolves to [] if the user backs out (no file chosen) — a cancel, not an
   * error — so callers don't flash a scary toast.
   */
  function pickFiles(): Promise<ShareableContact[]> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      // A broad accept list: iOS/macOS AirDrop hands out `.vcf` (text/vcard),
      // some Android exports use text/x-vcard, and text/directory is the legacy
      // MIME. Multiple so a batch export (one file, many cards — or many files)
      // all comes in at once.
      input.accept = '.vcf,text/vcard,text/x-vcard,text/directory'
      input.multiple = true
      let settled = false
      input.onchange = async () => {
        settled = true
        const files = input.files
        if (!files || !files.length) { resolve([]); return }
        try { resolve(await parseFiles(files)) }
        catch (err) { reject(err) }
      }
      input.oncancel = () => { settled = true; resolve([]) }
      // Safari/iOS don't reliably fire `oncancel`; when the window regains focus
      // without a change, treat it as a cancel so the promise never dangles.
      const onFocus = () => {
        setTimeout(() => {
          window.removeEventListener('focus', onFocus)
          if (!settled) resolve([])
        }, 800)
      }
      window.addEventListener('focus', onFocus)
      input.click()
    })
  }

  return { pickFiles, parseFiles, parseText }
}
