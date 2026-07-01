import { readItems, readUsers } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { assetUrl, getAvatarUrls, resolveBooking } from '../../utils/cards'
import { SOCIAL_KEYS } from '~/types/socials'

/**
 * PUBLIC digital business card for a user id. Reads the user's cd_cards row
 * (the editable card). Falls back to the Directus profile for users who haven't
 * customised a card yet. Read with the admin token since viewers are typically
 * unauthenticated; the id is a random UUID.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Card id required' })

  const admin = getDirectus()
  const cards = (await admin.request(
    readItems('cd_cards' as any, {
      filter: { user: { _eq: id } } as any,
      fields: ['display_name', 'title', 'company', 'email', 'phone', 'website', ...SOCIAL_KEYS, 'headline', 'office_address', 'image', 'cover_image', 'logo_image', 'card_theme'],
      limit: 1,
    }),
  )) as any[]

  let c = cards?.[0]
  if (!c) {
    // Fallback: synthesize from the Directus profile.
    const users = (await admin.request(
      readUsers({
        filter: { id: { _eq: id } } as any,
        fields: ['first_name', 'last_name', 'title', { organizations: [{ organizations_id: ['name'] }] }] as any,
        limit: 1,
      }),
    )) as any[]
    const u = users?.[0]
    if (!u) throw createError({ statusCode: 404, message: 'Card not found' })
    c = {
      display_name: [u.first_name, u.last_name].filter(Boolean).join(' '),
      title: u.title ?? null,
      company: u.organizations?.[0]?.organizations_id?.name ?? null,
    }
  }

  return {
    id,
    name: c.display_name || 'CardDesk user',
    title: c.title ?? null,
    company: c.company ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    website: c.website ?? null,
    ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, c[k] ?? null])),
    headline: c.headline ?? null,
    office_address: c.office_address ?? null,
    card_theme: c.card_theme || 'carddesk',
    // Photo: card image if set, otherwise the user's Earnest profile avatar
    // (getAvatarUrls prefers the card image, then the profile avatar) so a card
    // shows a real photo without extra setup.
    imageUrl: (await getAvatarUrls([id]))[id] ?? null,
    coverUrl: assetUrl(c.cover_image),
    logoUrl: assetUrl(c.logo_image),
    // Earnest-gated "Book a call" — present only for users with public
    // scheduling on; CardDesk-only users get { enabled:false } and no button.
    booking: await resolveBooking(id),
  }
})
