export interface ScannedCard {
  first_name: string | null; last_name: string | null; name: string | null
  title: string | null; company: string | null; email: string | null
  phone: string | null; website: string | null; linkedin: string | null
  address: string | null; industry: string | null
}

export type ScanStep = 'idle' | 'captured-front' | 'processing'

export function useCardScan() {
  const scanning = ref(false)
  const scanStep = ref<ScanStep>('idle')
  const error = ref<string | null>(null)
  const result = ref<ScannedCard | null>(null)
  const frontImage = ref<{ data: string; mediaType: string } | null>(null)

  async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 1600
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve({ data: canvas.toDataURL('image/jpeg', 0.9).split(',')[1], mediaType: 'image/jpeg' })
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = url
    })
  }

  function captureImage(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) { reject(new Error('No file selected')); return }
        resolve(file)
      }
      input.oncancel = () => reject(new Error('Cancelled'))
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
    try {
      const scanned = await $fetch<ScannedCard>('/api/scan-card', {
        method: 'POST', body: { images },
      })
      result.value = scanned
      return scanned
    } catch (err: any) {
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
