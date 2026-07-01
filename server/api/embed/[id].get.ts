import { resolveBooking } from '../../utils/cards'

/**
 * Embed payload for a card id: the public card, plus — when the user has Earnest
 * scheduling turned on — a booking URL pointing at Earnest's existing public
 * booking flow.
 *
 * Booking is Earnest-gated (see resolveBooking): a CardDesk-only user has no
 * `scheduler_settings` row, so `booking.enabled` stays false and the embed
 * renders card-only.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Card id required' })

  // Reuse the public card endpoint so the card shape stays identical to /c/:id.
  const card = await $fetch(`/api/cards/${id}`)
  const booking = (card as any)?.booking ?? (await resolveBooking(id))

  return { card, booking }
})
