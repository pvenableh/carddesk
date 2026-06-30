import { readItems } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'

/**
 * Embed payload for a card id: the public card, plus — when the user has Earnest
 * scheduling turned on — a booking URL pointing at Earnest's existing public
 * booking flow.
 *
 * Booking is Earnest-gated: a CardDesk-only user has no `scheduler_settings`
 * row (or `public_booking_enabled` is false), so `booking.enabled` stays false
 * and the embed renders card-only. Both apps share one Directus, so we can read
 * Earnest's scheduling rows here with the CardDesk admin token.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Card id required' })

  // Reuse the public card endpoint so the card shape stays identical to /c/:id.
  const card = await $fetch(`/api/cards/${id}`)

  const booking: { enabled: boolean; url: string | null } = { enabled: false, url: null }
  try {
    const admin = getDirectus()
    const settings = (await admin.request(
      readItems('scheduler_settings' as any, {
        fields: ['public_booking_enabled', 'booking_page_slug'],
        filter: { user_id: { _eq: id } } as any,
        limit: 1,
      }),
    )) as any[]

    const s = settings?.[0]
    if (s?.public_booking_enabled) {
      // Earnest's public booking URL is /book/<orgSlug>/<userSlug>. userSlug is
      // the per-user booking_page_slug when set, otherwise the user UUID.
      const orgs = (await admin.request(
        readItems('organizations' as any, {
          fields: ['slug'],
          filter: { users: { directus_users_id: { _eq: id } } } as any,
          limit: 1,
        }),
      )) as any[]
      const orgSlug = orgs?.[0]?.slug
      if (orgSlug) {
        const base = String(useRuntimeConfig().public.earnestAppUrl || '').replace(/\/$/, '')
        booking.enabled = true
        booking.url = `${base}/book/${orgSlug}/${s.booking_page_slug || id}`
      }
    }
  } catch {
    // Scheduling collections unavailable for this user/environment — the embed
    // gracefully falls back to a card-only widget.
  }

  return { card, booking }
})
