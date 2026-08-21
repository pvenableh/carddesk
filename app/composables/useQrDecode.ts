/**
 * QR decoding from a still image — the missing half of "scan someone's card".
 *
 * People increasingly hand out a *code* rather than a piece of card stock: a QR
 * on their phone screen (HiHello, Popl, Blinq, Apple/Google Wallet passes) or
 * printed on the back of a physical card. Photographing that and running OCR on
 * it gets you nothing, because the contact details are encoded, not printed.
 * This reads the code itself.
 *
 * Two decoders, in order of preference:
 *  1. `BarcodeDetector` — native, free, no download. Chrome/Android + recent
 *     Chromium desktop.
 *  2. `jsQR` — pure JS, lazy-imported only when (1) is missing. This is the
 *     path iOS Safari takes, i.e. most of our users, so it isn't a nicety.
 *
 * The payload is handed to `classifyCardPayload` (see ~/types/card-link), which
 * decides whether it's a whole vCard, a MECARD, or a link to chase.
 */
export function useQrDecode() {
  /** Native detector, or null when the browser doesn't ship one (Safari). */
  let detectorPromise: Promise<any | null> | null = null
  function getDetector(): Promise<any | null> {
    if (detectorPromise) return detectorPromise
    detectorPromise = (async () => {
      const Ctor = (globalThis as any).BarcodeDetector
      if (!Ctor) return null
      try {
        const formats: string[] = await Ctor.getSupportedFormats()
        if (!formats?.includes('qr_code')) return null
        return new Ctor({ formats: ['qr_code'] })
      } catch {
        return null
      }
    })()
    return detectorPromise
  }

  /** Load a File into an <img>, mirroring the timeout guards useCardScan uses
   *  for phone photos that never fire onload (huge images, undecodable HEIC). */
  function loadImage(file: File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url)
        reject(new Error("Couldn't read that photo"))
      }, 15000)
      img.onload = () => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(img) }
      img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo")) }
      img.src = url
    })
  }

  /** Natural pixel size of whatever we're decoding — an <img> reports it as
   *  width/height, a live <video> as videoWidth/videoHeight. */
  function sourceSize(src: HTMLImageElement | HTMLVideoElement): { w: number; h: number } {
    return src instanceof HTMLVideoElement
      ? { w: src.videoWidth, h: src.videoHeight }
      : { w: src.width, h: src.height }
  }

  function toImageData(img: HTMLImageElement | HTMLVideoElement, maxEdge: number): ImageData | null {
    const { w: sw, h: sh } = sourceSize(img)
    if (!sw || !sh) return null
    const scale = Math.min(1, maxEdge / Math.max(sw, sh))
    const w = Math.max(1, Math.round(sw * scale))
    const h = Math.max(1, Math.round(sh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    try {
      return ctx.getImageData(0, 0, w, h)
    } catch {
      return null // tainted canvas — can't happen for a local File, but be safe
    }
  }

  /**
   * Decode a single frame off a live camera feed. Kept deliberately cheap — it
   * runs several times a second while the scanner is open, so it tries one
   * modest resolution rather than the escalating passes a one-shot photo gets.
   * Returns null constantly and by design: most frames have no code in them.
   */
  async function decodeFrame(video: HTMLVideoElement): Promise<string | null> {
    if (!import.meta.client || video.readyState < 2) return null

    const detector = await getDetector()
    if (detector) {
      try {
        const codes = await detector.detect(video)
        const hit = codes?.find((c: any) => c.rawValue)?.rawValue
        if (hit) return String(hit)
        return null
      } catch {
        // Fall through to jsQR — some builds throw on certain frame sizes.
      }
    }

    let jsQR: typeof import('jsqr').default
    try {
      jsQR = (await import('jsqr')).default
    } catch {
      return null
    }
    const data = toImageData(video, 1000)
    if (!data) return null
    // 'dontInvert' only: a live feed gives us many chances at the code, and the
    // both-ways pass costs roughly double per frame.
    return jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }

  /**
   * Decode the first QR code in an image. Returns the raw payload string, or
   * null when there's no readable code (the common case for a plain business
   * card — callers fall back to the AI text scan).
   */
  async function decodeImage(file: File | Blob): Promise<string | null> {
    if (!import.meta.client) return null
    let img: HTMLImageElement
    try {
      img = await loadImage(file)
    } catch {
      return null
    }

    const detector = await getDetector()
    if (detector) {
      try {
        const codes = await detector.detect(img)
        const hit = codes?.find((c: any) => c.rawValue)?.rawValue
        if (hit) return String(hit)
      } catch {
        // Fall through to jsQR rather than failing the whole capture.
      }
    }

    // A photo of a phone screen is usually 3-4k px wide; jsQR gets both slower
    // and *less* reliable at that size, so try a mid resolution first and only
    // then a larger one for small/distant codes.
    let jsQR: typeof import('jsqr').default
    try {
      jsQR = (await import('jsqr')).default
    } catch (err) {
      console.error('[qr] decoder unavailable', err)
      return null
    }
    for (const maxEdge of [1400, 2200, 800]) {
      const data = toImageData(img, maxEdge)
      if (!data) continue
      const result = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })
      if (result?.data) return result.data
    }
    return null
  }

  return { decodeImage, decodeFrame }
}
