export interface ScannedCard {
  first_name: string | null; last_name: string | null; name: string | null
  title: string | null; company: string | null; email: string | null
  phone: string | null; website: string | null; linkedin: string | null
  address: string | null; industry: string | null
}

export function useCardScan() {
  const scanning = ref(false)
  const error = ref<string | null>(null)
  const result = ref<ScannedCard | null>(null)

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

  async function scanFile(file: File): Promise<ScannedCard> {
    scanning.value = true; error.value = null; result.value = null
    try {
      const { data, mediaType } = await fileToBase64(file)
      const scanned = await $fetch<ScannedCard>('/api/scan-card', {
        method: 'POST', body: { image: data, mediaType },
      })
      result.value = scanned
      return scanned
    } catch (err: any) {
      const msg = err?.data?.message ?? 'Scan failed — try a clearer photo'
      error.value = msg; throw new Error(msg)
    } finally { scanning.value = false }
  }

  function openCamera(): Promise<ScannedCard> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) { reject(new Error('No file selected')); return }
        try { resolve(await scanFile(file)) } catch (err) { reject(err) }
      }
      input.oncancel = () => reject(new Error('Cancelled'))
      input.click()
    })
  }

  return {
    scanning, error, result, scanFile, openCamera,
    reset: () => { result.value = null; error.value = null },
  }
}
