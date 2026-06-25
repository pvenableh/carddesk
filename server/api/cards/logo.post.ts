import { updateItem } from '@directus/sdk'
import { getUserClient } from '../../utils/auth'
import { getOrCreateCard, assetUrl } from '../../utils/cards'
import { uploadCardDeskFile, readUploadFile } from '../../utils/uploads'

/**
 * Upload a company logo for the card. Forwards the file to Directus (filed under
 * the CardDesk "Card Logos" folder), then stores the file id on the user's
 * cd_cards row. Mirrors image.post.ts / cover.post.ts.
 */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)

  const file = await readUploadFile(event)
  const fileId = await uploadCardDeskFile(file, 'logo')

  const card = await getOrCreateCard(me, directus)
  await directus.request(updateItem('cd_cards' as any, card.id, { logo_image: fileId } as any))

  return { logo_image: fileId, logoUrl: assetUrl(fileId) }
})
