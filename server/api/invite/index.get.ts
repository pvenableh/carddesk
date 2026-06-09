import { randomBytes } from 'node:crypto'
import { readItems, createItem } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

/**
 * Returns the caller's evergreen personal invite link, creating it on first
 * use. Sharing the URL and having someone sign up / redeem it creates an
 * accepted connection both ways (see invite/redeem.post.ts).
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const config = useRuntimeConfig()
  const admin = getDirectus()

  const existing = (await admin.request(
    readItems('cd_invites' as any, {
      filter: { inviter: { _eq: me }, expires_at: { _null: true } } as any,
      fields: ['code'],
      limit: 1,
      sort: ['-date_created'],
    }),
  )) as any[]

  let code: string = existing?.[0]?.code
  if (!code) {
    code = randomBytes(6).toString('base64url') // ~8 url-safe chars
    await admin.request(createItem('cd_invites' as any, { inviter: me, code } as any))
  }

  return { code, url: `${config.public.appUrl}/i/${code}` }
})
