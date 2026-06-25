import { getOrCreateCard, assetUrl, getAvatarUrls } from '../../utils/cards'
import { getUserClient } from '../../utils/auth'

/** The signed-in user's editable card + its public share URL (/c/:id). */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)
  const config = useRuntimeConfig()
  const card = await getOrCreateCard(me, directus)
  return {
    ...card,
    name: card.display_name || 'CardDesk user',
    // Fall back to the Earnest profile avatar when no card photo is set.
    imageUrl: (await getAvatarUrls([me]))[me] ?? null,
    coverUrl: assetUrl(card.cover_image),
    logoUrl: assetUrl(card.logo_image),
    url: `${config.public.appUrl}/c/${me}`,
  }
})
