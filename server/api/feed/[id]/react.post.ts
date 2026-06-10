import { readItems, createItem, deleteItem } from '@directus/sdk'
import { getUserClient } from '../../../utils/auth'

const ALLOWED = ['👏', '🔥', '🤝', '🎉', '💡']

/**
 * Set the caller's emoji reaction on a feed event. One reaction per user per
 * event: clicking your current emoji clears it; clicking a different one
 * switches to it (the old one is removed). Returns the new reacted state.
 */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)
  const id = getRouterParam(event, 'id')
  const { emoji } = await readBody(event)
  if (!id) throw createError({ statusCode: 400, message: 'Event id required' })
  if (!ALLOWED.includes(emoji)) throw createError({ statusCode: 400, message: 'Invalid reaction' })

  // All of this user's reactions on this event (should be ≤1, but clean up any).
  const existing = (await directus.request(
    readItems('cd_reactions' as any, {
      filter: { user: { _eq: me }, event: { _eq: id } } as any,
      fields: ['id', 'emoji'],
      limit: 10,
    }),
  )) as any[]

  const sameEmoji = existing.find((r) => r.emoji === emoji)
  // Remove every existing reaction by this user (toggling off, or making room
  // for the switch — enforces the one-per-user rule).
  for (const r of existing) {
    await directus.request(deleteItem('cd_reactions' as any, r.id))
  }

  if (sameEmoji) return { reacted: false }

  await directus.request(createItem('cd_reactions' as any, { user: me, event: id, emoji } as any))
  return { reacted: true }
})
