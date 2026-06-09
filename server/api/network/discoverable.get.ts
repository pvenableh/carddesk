import { readUsers } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

/**
 * Read the caller's directory-discoverable flag. Uses the admin client because
 * the CardDesk user role doesn't grant field-level access to this custom
 * `directus_users` field (writing via the user token 500s), so we keep the
 * whole flag server-managed — consistent with the cd_connections pattern.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const admin = getDirectus()
  const users = (await admin.request(
    readUsers({ filter: { id: { _eq: me } } as any, fields: ['discoverable'], limit: 1 }),
  )) as any[]
  return { discoverable: !!users?.[0]?.discoverable }
})
