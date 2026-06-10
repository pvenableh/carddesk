export interface ScannedCard {
  first_name: string | null; last_name: string | null; name: string | null
  title: string | null; company: string | null; email: string | null
  phone: string | null; website: string | null; linkedin: string | null
  address: string | null; industry: string | null
}

export type ScanStep = 'idle' | 'captured-front' | 'processing'

export function useCardScan() {
  const analytics = useAnalytics()
  const scanning = ref(false)
  const scanStep = ref<ScanStep>('idle')
  const error = ref<string | null>(null)
  const result = ref<ScannedCard | null>(null)
  const frontImage = ref<{ data: string; mediaType: string } | null>(null)

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

  function captureImage(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
      let settled = false
      input.onchange = () => {
        settled = true
        const file = input.files?.[0]
        // No file means the user backed out of the picker — treat as a cancel,
        // not an error, so we don't flash a scary toast.
        if (!file) { reject(new Error('Cancelled')); return }
        resolve(file)
      }
      input.oncancel = () => { settled = true; reject(new Error('Cancelled')) }
      // Safari/iOS don't reliably fire `oncancel`. When the window regains focus
      // without a change event, the user dismissed the camera/picker — resolve as
      // a cancel after a short grace period so the promise never dangles.
      const onFocus = () => {
        setTimeout(() => {
          window.removeEventListener('focus', onFocus)
          if (!settled) reject(new Error('Cancelled'))
        }, 800)
      }
      window.addEventListener('focus', onFocus)
      input.click()
    })
  }

  async function captureFront(): Promise<void> {
    error.value = null
    const file = await captureImage()
    frontImage.value = await fileToBase64(file)
    scanStep.value = 'captured-front'
  }

  async function captureBackAndScan(): Promise<ScannedCard> {
    error.value = null
    const file = await captureImage()
    const backImage = await fileToBase64(file)
    return await processImages([frontImage.value!, backImage])
  }

  async function scanFrontOnly(): Promise<ScannedCard> {
    return await processImages([frontImage.value!])
  }

  async function processImages(images: { data: string; mediaType: string }[]): Promise<ScannedCard> {
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
      const msg = err?.data?.message ?? 'Scan failed — try a clearer photo'
      error.value = msg; throw new Error(msg)
    } finally {
      scanning.value = false
      scanStep.value = 'idle'
      frontImage.value = null
    }
  }

  // Legacy: single image scan (used by quick scan)
  async function openCamera(): Promise<ScannedCard> {
    error.value = null; result.value = null
    const file = await captureImage()
    const imageData = await fileToBase64(file)
    return await processImages([imageData])
  }

  return {
    scanning, scanStep, error, result, frontImage,
    captureFront, captureBackAndScan, scanFrontOnly, openCamera,
    reset: () => { result.value = null; error.value = null; scanStep.value = 'idle'; frontImage.value = null },
  }
}
