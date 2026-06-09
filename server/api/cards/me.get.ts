import { getOrCreateCard, assetUrl } from '../../utils/cards'
import { getUserClient } from '../../utils/auth'

/** The signed-in user's editable card + its public share URL (/c/:id). */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)
  const config = useRuntimeConfig()
  const card = await getOrCreateCard(me, directus)
  return {
    ...card,
    name: card.display_name || 'CardDesk user',
    imageUrl: assetUrl(card.image),
    url: `${config.public.appUrl}/c/${me}`,
  }
})
