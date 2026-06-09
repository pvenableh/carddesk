import { readItems, readUsers, createItem, updateItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getUserClient } from '../../utils/auth'

/**
 * Send a connection request. Body: { userId } (the addressee).
 *
 * Idempotency / mutual-intent handling:
 *  - If a connection already exists between the two users in either direction,
 *    we don't create a duplicate. If the existing row is a pending request the
 *    OTHER person sent to me, accepting-by-requesting auto-accepts it (mutual
 *    intent → instant connection). Otherwise we return the existing row as-is.
 */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)
  const { userId } = await readBody(event)

  if (!userId || typeof userId !== 'string')
    throw createError({ statusCode: 400, message: 'userId is required' })
  if (userId === me)
    throw createError({ statusCode: 400, message: "You can't connect with yourself" })

  // System lookups (user existence, the edge between us) use the static token —
  // the user role can't read directus_users or the other party's connection row.
  const admin = getDirectus()

  // Target must be a real user.
  const targets = (await admin.request(
    readUsers({ filter: { id: { _eq: userId } } as any, fields: ['id'], limit: 1 }),
  )) as any[]
  if (!targets?.length)
    throw createError({ statusCode: 404, message: 'User not found' })

  // Any existing edge between us, either direction?
  const existing = (await admin.request(
    readItems('cd_connections' as any, {
      filter: {
        _or: [
          { _and: [{ requester: { _eq: me } }, { addressee: { _eq: userId } }] },
          { _and: [{ requester: { _eq: userId } }, { addressee: { _eq: me } }] },
        ],
      } as any,
      fields: ['id', 'status', 'requester', 'addressee'],
      limit: 1,
    }),
  )) as any[]

  const edge = existing?.[0]
  if (edge) {
    const theyRequestedMe = edge.requester === userId && edge.addressee === me
    if (edge.status === 'pending' && theyRequestedMe) {
      // Accepting by requesting back — I'm the addressee, so I may update it.
      const updated = await directus.request(
        updateItem('cd_connections' as any, edge.id, { status: 'accepted' } as any),
      )
      return { connection: updated, mutual: true }
    }
    // Already pending/accepted/blocked — return as-is, no duplicate.
    return { connection: edge, existing: true }
  }

  const created = await directus.request(
    createItem('cd_connections' as any, {
      requester: me,
      addressee: userId,
      status: 'pending',
    } as any),
  )

  return { connection: created }
})
