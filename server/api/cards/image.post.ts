import { updateItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { getOrCreateCard, assetUrl } from '../../utils/cards'

/**
 * Upload a card image. Receives multipart, forwards the file to Directus /files
 * with the static token, then stores the file id on the user's cd_cards row.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const config = useRuntimeConfig()

  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.filename)
  if (!file) throw createError({ statusCode: 400, message: 'No file provided' })
  if (file.data.length > 5 * 1024 * 1024) throw createError({ statusCode: 413, message: 'Image must be under 5MB' })

  const fd = new FormData()
  fd.append('file', new Blob([file.data], { type: file.type || 'application/octet-stream' }), file.filename)

  const directusUrl = String(config.public.directusUrl).replace(/\/$/, '')
  const res = await fetch(`${directusUrl}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.directusStaticToken}` },
    body: fd,
  })
  if (!res.ok) {
    console.error('[cards/image] upload failed', res.status, await res.text().catch(() => ''))
    throw createError({ statusCode: 502, message: 'Image upload failed' })
  }
  const json = (await res.json()) as any
  const fileId = json?.data?.id
  if (!fileId) throw createError({ statusCode: 502, message: 'Image upload failed' })

  const card = await getOrCreateCard(me)
  const admin = getDirectus()
  await admin.request(updateItem('cd_cards' as any, card.id, { image: fileId } as any))

  return { image: fileId, imageUrl: assetUrl(fileId) }
})
