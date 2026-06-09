import { updateItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { getOrCreateCard, assetUrl } from '../../utils/cards'

const EDITABLE = ['display_name', 'title', 'company', 'email', 'phone', 'website', 'linkedin', 'headline', 'broadcast_activity'] as const

/** Update the signed-in user's card (admin-token write; server owns the row). */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const body = await readBody(event)
  const card = await getOrCreateCard(me)

  const payload: Record<string, any> = {}
  for (const f of EDITABLE) {
    if (body[f] !== undefined) payload[f] = f === 'broadcast_activity' ? !!body[f] : (body[f] || null)
  }
  if (!Object.keys(payload).length) return { ...card, imageUrl: assetUrl(card.image) }

  const admin = getDirectus()
  const updated = (await admin.request(updateItem('cd_cards' as any, card.id, payload as any))) as any
  return { ...updated, name: updated.display_name || 'CardDesk user', imageUrl: assetUrl(updated.image) }
})
