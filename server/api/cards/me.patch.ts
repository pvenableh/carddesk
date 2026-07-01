import { updateItem } from '@directus/sdk'
import { getUserClient } from '../../utils/auth'
import { getOrCreateCard, assetUrl } from '../../utils/cards'
import { SOCIAL_KEYS } from '~/types/socials'

const EDITABLE = ['display_name', 'title', 'company', 'email', 'phone', 'website', ...SOCIAL_KEYS, 'headline', 'office_address', 'show_address', 'flat_layout', 'broadcast_activity', 'card_theme', 'cover_image', 'logo_image']
const BOOL_FIELDS = new Set(['broadcast_activity', 'show_address', 'flat_layout'])

/** Update the signed-in user's card (written as the user; row is scoped to them). */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)
  const body = await readBody(event)
  const card = await getOrCreateCard(me, directus)

  const payload: Record<string, any> = {}
  for (const f of EDITABLE) {
    if (body[f] !== undefined) payload[f] = BOOL_FIELDS.has(f) ? !!body[f] : (body[f] || null)
  }
  if (!Object.keys(payload).length) return { ...card, imageUrl: assetUrl(card.image) }

  const updated = (await directus.request(updateItem('cd_cards' as any, card.id, payload as any))) as any
  return { ...updated, name: updated.display_name || 'CardDesk user', imageUrl: assetUrl(updated.image) }
})
