import { readItem, updateItem, deleteItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { emitFeedEvent } from '../../utils/feed'
import { awardServerXp } from '../../utils/xp'

/**
 * Update a connection: accept / decline / block, or remove it.
 * Body: { action: 'accept' | 'decline' | 'block' | 'remove' }
 *
 * Rules (enforced server-side):
 *  - accept / decline: only the ADDRESSEE of a pending request may act.
 *  - block / remove: either party may act.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const id = getRouterParam(event, 'id')
  const { action } = await readBody(event)

  if (!id) throw createError({ statusCode: 400, message: 'Connection id is required' })
  if (!['accept', 'decline', 'block', 'remove'].includes(action))
    throw createError({ statusCode: 400, message: 'Invalid action' })

  const admin = getDirectus()

  const row = (await admin
    .request(readItem('cd_connections' as any, id, { fields: ['id', 'status', 'requester', 'addressee'] }))
    .catch(() => null)) as any
  if (!row) throw createError({ statusCode: 404, message: 'Connection not found' })

  const isRequester = row.requester === me
  const isAddressee = row.addressee === me
  if (!isRequester && !isAddressee)
    throw createError({ statusCode: 403, message: 'Not your connection' })

  if (action === 'remove') {
    await admin.request(deleteItem('cd_connections' as any, id))
    return { ok: true, removed: true }
  }

  if (action === 'accept' || action === 'decline') {
    if (!isAddressee)
      throw createError({ statusCode: 403, message: 'Only the recipient can respond to this request' })
    if (row.status !== 'pending')
      throw createError({ statusCode: 409, message: `Request is already ${row.status}` })
    const updated = await admin.request(
      updateItem('cd_connections' as any, id, { status: action === 'accept' ? 'accepted' : 'declined' } as any),
    )
    if (action === 'accept') {
      await emitFeedEvent(me, 'connected', {})
      await emitFeedEvent(row.requester, 'connected', {})
      // Accepter earns client-side (+15); credit the requester (often offline) here.
      await awardServerXp(row.requester, 15)
    }
    return { connection: updated }
  }

  // block — either party
  const updated = await admin.request(
    updateItem('cd_connections' as any, id, { status: 'blocked' } as any),
  )
  return { connection: updated }
})
