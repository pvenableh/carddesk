/**
 * Downscale + recompress an image in the browser before upload. A 5MB phone
 * photo typically shrinks to ~150–300KB, which keeps stored files small so
 * storage stays cheap — the pragmatic guardrail instead of quota billing.
 * Returns the original file untouched if anything goes wrong or it wouldn't help.
 */
export async function downscaleImage(
  file: File,
  opts: { maxDim?: number; quality?: number; mime?: string } = {},
): Promise<Blob> {
  const { maxDim = 1280, quality = 0.82, mime = 'image/jpeg' } = opts
  // Skip non-images and animated GIFs (canvas would flatten them).
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality))
    // Only use the recompressed version if it's actually smaller.
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
