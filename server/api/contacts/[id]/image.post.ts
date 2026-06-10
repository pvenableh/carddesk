import { updateItem } from '@directus/sdk'
import { getUserClient } from '../../../utils/auth'
import { assetUrl } from '../../../utils/cards'
import { uploadCardDeskFile, readUploadFile } from '../../../utils/uploads'

/**
 * Upload a photo for one of the user's contacts. Files into the CardDesk
 * "Contact Photos" folder, then stores the file id on the cd_contacts row. The
 * update runs on the user's token, so the policy scopes it to their own
 * contacts (they can't set a photo on someone else's row).
 */
export default defineEventHandler(async (event) => {
  const { directus } = await getUserClient(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Contact ID required' })

  const file = await readUploadFile(event)
  const fileId = await uploadCardDeskFile(file, 'contact')

  try {
    await directus.request(updateItem('cd_contacts' as any, id, { image: fileId } as any))
  } catch (err: any) {
    console.error('[contacts/image] update failed:', err?.errors ?? err?.message ?? err)
    throw createError({ statusCode: err?.status ?? 500, message: 'Could not save contact photo' })
  }

  return { image: fileId, imageUrl: assetUrl(fileId) }
})
