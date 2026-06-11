import { readItems, readUsers, createItem, updateItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'
import { emitFeedEvent } from '../../utils/feed'
import { awardServerXp } from '../../utils/xp'

/**
 * Redeem an invite code (called after the invitee signs up / logs in). Creates
 * an ACCEPTED connection between the inviter and the caller in both directions
 * (idempotent), records the redemption on the invite for audit, and — when the
 * inviter already has the new user saved as a contact (matched by email) —
 * stamps that contact's `linked_user`, so the same human stops being two
 * unrelated records (contact rows show a "joined" badge; the orbit dedupes).
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const { code } = await readBody(event)

  if (!code || typeof code !== 'string')
    throw createError({ statusCode: 400, message: 'Invite code is required' })

  const admin = getDirectus()

  const invites = (await admin.request(
    readItems('cd_invites' as any, {
      filter: { code: { _eq: code } } as any,
      fields: ['id', 'inviter', 'expires_at'],
      limit: 1,
    }),
  )) as any[]

  const invite = invites?.[0]
  if (!invite) throw createError({ statusCode: 404, message: 'Invite not found' })
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())
    throw createError({ statusCode: 410, message: 'This invite has expired' })

  const inviter = invite.inviter
  if (inviter === me)
    throw createError({ statusCode: 400, message: "You can't redeem your own invite" })

  // Confirm inviter still exists.
  const inviterUsers = (await admin.request(
    readUsers({ filter: { id: { _eq: inviter } } as any, fields: ['id', 'first_name', 'last_name'], limit: 1 }),
  )) as any[]
  const inviterUser = inviterUsers?.[0]
  if (!inviterUser) throw createError({ statusCode: 404, message: 'Inviter no longer exists' })

  // Upsert an accepted edge in either direction.
  const existing = (await admin.request(
    readItems('cd_connections' as any, {
      filter: {
        _or: [
          { _and: [{ requester: { _eq: me } }, { addressee: { _eq: inviter } }] },
          { _and: [{ requester: { _eq: inviter } }, { addressee: { _eq: me } }] },
        ],
      } as any,
      fields: ['id', 'status'],
      limit: 1,
    }),
  )) as any[]

  if (existing?.[0]) {
    if (existing[0].status !== 'accepted' && existing[0].status !== 'blocked')
      await admin.request(updateItem('cd_connections' as any, existing[0].id, { status: 'accepted' } as any))
  } else {
    await admin.request(
      createItem('cd_connections' as any, { requester: inviter, addressee: me, status: 'accepted' } as any),
    )
  }

  await admin
    .request(updateItem('cd_invites' as any, invite.id, { accepted_by: me, accepted_at: new Date().toISOString() } as any))
    .catch(() => {})

  // Contact ↔ user bridge: if the inviter saved this person as a contact
  // before they joined, link the records (matched on the new user's email).
  // Best-effort — a failure here shouldn't block the connection.
  try {
    const meUsers = (await admin.request(
      readUsers({ filter: { id: { _eq: me } } as any, fields: ['id', 'email'], limit: 1 }),
    )) as any[]
    const myEmail = meUsers?.[0]?.email?.toLowerCase()
    if (myEmail) {
      const matches = (await admin.request(
        readItems('cd_contacts' as any, {
          filter: {
            _and: [
              { user_created: { _eq: inviter } },
              { email: { _ieq: myEmail } },
              { linked_user: { _null: true } },
            ],
          } as any,
          fields: ['id'],
          limit: 5,
        }),
      )) as any[]
      for (const c of matches ?? [])
        await admin.request(updateItem('cd_contacts' as any, c.id, { linked_user: me } as any))
    }
  } catch (err) {
    console.error('[invite/redeem] contact link failed:', err)
  }

  await emitFeedEvent(me, 'joined', {})
  await emitFeedEvent(inviter, 'connected', {})
  // The inviter is typically offline when their link converts — credit them server-side.
  await awardServerXp(inviter, 75)

  return {
    connected: true,
    inviter: {
      id: inviterUser.id,
      name: [inviterUser.first_name, inviterUser.last_name].filter(Boolean).join(' ') || 'CardDesk user',
    },
  }
})
