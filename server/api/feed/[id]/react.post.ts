import { readItems, createItem, deleteItem } from '@directus/sdk'
import { getDirectus } from '../../../utils/directus'
import { getCurrentUserId } from '../../../utils/auth'

const ALLOWED = ['👏', '🔥', '🤝', '🎉', '💡']

/** Toggle an emoji reaction on a feed event. Returns the new reacted state. */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const id = getRouterParam(event, 'id')
  const { emoji } = await readBody(event)
  if (!id) throw createError({ statusCode: 400, message: 'Event id required' })
  if (!ALLOWED.includes(emoji)) throw createError({ statusCode: 400, message: 'Invalid reaction' })

  const admin = getDirectus()
  const existing = (await admin.request(
    readItems('cd_reactions' as any, {
      filter: { user: { _eq: me }, event: { _eq: id }, emoji: { _eq: emoji } } as any,
      fields: ['id'],
      limit: 1,
    }),
  )) as any[]

  if (existing?.[0]) {
    await admin.request(deleteItem('cd_reactions' as any, existing[0].id))
    return { reacted: false }
  }
  await admin.request(createItem('cd_reactions' as any, { user: me, event: id, emoji } as any))
  return { reacted: true }
})
