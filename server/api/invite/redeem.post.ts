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
      fields: ['id', 'inviter', 'expires_at', 'contact'],
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

  // Contact ↔ user bridge: link the inviter's contact record to the new user so
  // the same human stops being two unrelated rows. A contact-targeted invite
  // (invite.contact) links that EXACT contact — deterministic, no guessing. A
  // generic invite falls back to matching the inviter's contacts by email.
  // Best-effort — a failure here shouldn't block the connection.
  try {
    if (invite.contact) {
      // Deterministic: only if it's the inviter's contact and not already linked.
      const owned = (await admin.request(
        readItems('cd_contacts' as any, {
          filter: {
            _and: [
              { id: { _eq: invite.contact } },
              { user_created: { _eq: inviter } },
              { linked_user: { _null: true } },
            ],
          } as any,
          fields: ['id'],
          limit: 1,
        }),
      )) as any[]
      if (owned?.[0]) await admin.request(updateItem('cd_contacts' as any, owned[0].id, { linked_user: me } as any))
    } else {
      const meUsers = (await admin.request(
        readUsers({ filter: { id: { _eq: me } } as any, fields: ['id', 'email'], limit: 1 }),
      )) as any[]
      const myEmail = meUsers?.[0]?.email?.toLowerCase()
      if (myEmail) {
        // Directus has no case-insensitive-equals operator on the email field, so
        // narrow with _icontains then exact-match case-insensitively client-side
        // (mirrors the existing-user lookup in server/api/auth/register.post.ts).
        const candidates = (await admin.request(
          readItems('cd_contacts' as any, {
            filter: {
              _and: [
                { user_created: { _eq: inviter } },
                { email: { _icontains: myEmail } },
                { linked_user: { _null: true } },
              ],
            } as any,
            fields: ['id', 'email'],
            limit: 20,
          }),
        )) as any[]
        const matches = (candidates ?? []).filter((c) => (c.email ?? '').toLowerCase() === myEmail)
        for (const c of matches)
          await admin.request(updateItem('cd_contacts' as any, c.id, { linked_user: me } as any))
      }
    }
  } catch (err) {
    console.error('[invite/redeem] contact link failed:', err)
  }

  await emitFeedEvent(me, 'joined', {})
  await emitFeedEvent(inviter, 'connected', {})
  // The inviter is typically offline when their link converts — credit them
  // server-side and bump their accepted-invite counter (drives the Recruiter badge).
  await awardServerXp(inviter, 75, { invites_accepted: 1 })

  return {
    connected: true,
    inviter: {
      id: inviterUser.id,
      name: [inviterUser.first_name, inviterUser.last_name].filter(Boolean).join(' ') || 'CardDesk user',
    },
  }
})
