export interface ScannedCard {
  first_name: string | null; last_name: string | null; name: string | null
  title: string | null; company: string | null; email: string | null
  phone: string | null; website: string | null; linkedin: string | null
  address: string | null; industry: string | null
}

export type ScanStep = 'idle' | 'reading-code' | 'captured-front' | 'processing'

export function useCardScan() {
  const analytics = useAnalytics()
  const { decodeImage } = useQrDecode()
  const scanning = ref(false)
  const scanStep = ref<ScanStep>('idle')
  const error = ref<string | null>(null)
  const result = ref<ScannedCard | null>(null)
  const frontImage = ref<{ data: string; mediaType: string } | null>(null)
  const backImage = ref<{ data: string; mediaType: string } | null>(null)
  /** Raw payload of a QR code found in the captured photo, if any. The scan
   *  screen decides what to do with it — a code usually beats OCR (it's exact,
   *  and free), but a QR printed on a business card can just be a link to the
   *  company site, so a link is offered rather than taken automatically. */
  const qrPayload = ref<string | null>(null)
  /** Same, for the back of the card — plenty of cards print the QR there, and
   *  a code we never look for is a code we never offer. */
  const backQrPayload = ref<string | null>(null)

  async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      // Some phone photos (very large, or HEIC on browsers that can't decode it)
      // never fire onload/onerror — guard with a timeout so the flow can recover
      // instead of hanging silently.
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url)
        reject(new Error("Couldn't read that photo — try again"))
      }, 15000)
      img.onload = () => {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
        try {
          const MAX = 1600
          const scale = Math.min(1, MAX / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * scale)
          canvas.height = Math.round(img.height * scale)
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve({ data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1], mediaType: 'image/jpeg' })
        } catch (e) {
          reject(new Error("Couldn't read that photo — try again"))
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
        reject(new Error("Couldn't read that photo — try again"))
      }
      img.src = url
    })
  }

  async function captureFront(opts: { thorough?: boolean } = {}): Promise<string | null> {
    error.value = null
    qrPayload.value = null
    const file = await capturePhoto()
    // Look for a QR before anything else: someone showing you their digital
    // card on a phone screen has no printed text to OCR, and a code carries
    // exact details instead of Claude's best reading of them.
    scanStep.value = 'reading-code'
    // Thorough only when the user came here to photograph a *code* (the live
    // scanner's fallback); a card scan takes the cheap pass — see decodeImage.
    qrPayload.value = await decodeImage(file, { quick: !opts.thorough }).catch(() => null)
    // Keep the photo either way — if the user would rather scan the card than
    // follow its QR, we already have the image and don't re-open the camera.
    frontImage.value = await fileToBase64(file)
    scanStep.value = 'captured-front'
    return qrPayload.value
  }

  /**
   * Capture the back of the card and read any QR on it, returning the payload.
   * The scan itself is a separate step (`scanBothSides`) so the screen can act
   * on a code first — a back-printed QR that carries the whole card is exact
   * and free, and spending the scan on it anyway would be a waste.
   */
  async function captureBack(): Promise<string | null> {
    error.value = null
    backQrPayload.value = null
    const file = await capturePhoto()
    scanStep.value = 'reading-code'
    backQrPayload.value = await decodeImage(file, { quick: true }).catch(() => null)
    backImage.value = await fileToBase64(file)
    scanStep.value = 'captured-front'
    return backQrPayload.value
  }

  /** Scan both captured sides together. */
  async function scanBothSides(): Promise<ScannedCard> {
    return await processImages([frontImage.value!, backImage.value!])
  }

  async function scanFrontOnly(): Promise<ScannedCard> {
    return await processImages([frontImage.value!])
  }

  async function processImages(
    images: { data: string; mediaType: string }[],
    opts: { stashOnNetworkError?: boolean } = {},
  ): Promise<ScannedCard> {
    scanning.value = true; scanStep.value = 'processing'; error.value = null; result.value = null
    const sides = images.length
    analytics.cardScanStart(sides)
    try {
      const scanned = await $fetch<ScannedCard>('/api/scan-card', {
        method: 'POST', body: { images },
      })
      result.value = scanned
      analytics.cardScanSuccess(sides)
      return scanned
    } catch (err: any) {
      analytics.cardScanFailed(sides)
      // A network failure (offline, dead conference wifi) has no HTTP status —
      // the capture is good, only the upload failed. Stash it so the card is
      // never lost; the scan screen offers a one-tap retry when back online.
      const isNetworkError =
        (import.meta.client && !navigator.onLine) ||
        (err?.status == null && err?.statusCode == null && err?.response == null)
      let msg = err?.data?.message ?? 'Scan failed — try a clearer photo'
      if (isNetworkError && (opts.stashOnNetworkError ?? true)) {
        const eventMode = useEventMode()
        const stashed = usePendingScans().stash(images, eventMode.active.value ? eventMode.name.value : null)
        msg = stashed
          ? 'No connection — your card is saved. Process it from the scan screen when you\'re back online.'
          : 'No connection, and the offline queue is full — try again once you\'re back online.'
      } else if (isNetworkError) {
        msg = 'Still no connection — your card is safe in the queue.'
      }
      error.value = msg; throw new Error(msg)
    } finally {
      scanning.value = false
      scanStep.value = 'idle'
      frontImage.value = null
      backImage.value = null
    }
  }

  // Legacy: single image scan (used by quick scan)
  async function openCamera(): Promise<ScannedCard> {
    error.value = null; result.value = null
    const file = await capturePhoto()
    const imageData = await fileToBase64(file)
    return await processImages([imageData])
  }

  return {
    scanning, scanStep, error, result, frontImage, qrPayload, backQrPayload,
    captureFront, captureBack, scanBothSides, scanFrontOnly, openCamera,
    // Exposed so the scan screen can replay stashed offline captures.
    processImages,
    reset: () => {
      result.value = null; error.value = null; scanStep.value = 'idle'
      frontImage.value = null; backImage.value = null
      qrPayload.value = null; backQrPayload.value = null
    },
  }
}
