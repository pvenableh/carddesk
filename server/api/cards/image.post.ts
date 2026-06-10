import { updateItem } from '@directus/sdk'
import { getUserClient } from '../../utils/auth'
import { getOrCreateCard, assetUrl } from '../../utils/cards'
import { uploadCardDeskFile, readUploadFile } from '../../utils/uploads'

/**
 * Upload a card image. Forwards the file to Directus (filed under the CardDesk
 * "Card Images" folder), then stores the file id on the user's cd_cards row.
 */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)

  const file = await readUploadFile(event)
  const fileId = await uploadCardDeskFile(file, 'card')

  const card = await getOrCreateCard(me, directus)
  await directus.request(updateItem('cd_cards' as any, card.id, { image: fileId } as any))

  return { image: fileId, imageUrl: assetUrl(fileId) }
})
