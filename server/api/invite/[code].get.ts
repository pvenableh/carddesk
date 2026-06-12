import { readItems, readUsers } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'

/**
 * GET /api/invite/:code — read-only preview of an invite (no redeem, no auth).
 *
 * Lets the sign-up screen greet an invited visitor by name ("Maya invited you
 * to connect") before they have an account. Returns ONLY the inviter's display
 * name and, for a contact-targeted invite, the first name it was personalized
 * for — never anything sensitive. Unknown/expired codes resolve to a null
 * inviter rather than an error, so the form just falls back to the generic copy.
 */
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code')
  if (!code) return { inviter: null }

  const admin = getDirectus()

  const invites = (await admin.request(
    readItems('cd_invites' as any, {
      filter: { code: { _eq: code } } as any,
      fields: ['inviter', 'expires_at', 'contact'],
      limit: 1,
    }),
  )) as any[]

  const invite = invites?.[0]
  if (!invite) return { inviter: null }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())
    return { inviter: null }

  const users = (await admin.request(
    readUsers({ filter: { id: { _eq: invite.inviter } } as any, fields: ['first_name', 'last_name'], limit: 1 }),
  )) as any[]
  const u = users?.[0]
  if (!u) return { inviter: null }

  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'A CardDesk user'
  return { inviter: { name, firstName: u.first_name || null } }
})
