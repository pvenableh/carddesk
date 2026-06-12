import { randomBytes } from 'node:crypto'
import { readItems, createItem } from '@directus/sdk'
import { getUserClient } from '../../utils/auth'

/**
 * Returns the caller's evergreen GENERIC personal invite link, creating it on
 * first use. Sharing the URL and having someone sign up / redeem it creates an
 * accepted connection both ways (see invite/redeem.post.ts).
 *
 * Must exclude contact-targeted invites (invite/send.post.ts) — those also have
 * no expiry, so without the contact/target_email guards this query would pick up
 * the most recent one and hand out a link minted for a specific contact.
 */
export default defineEventHandler(async (event) => {
  const { me, directus } = await getUserClient(event)
  const config = useRuntimeConfig()

  const existing = (await directus.request(
    readItems('cd_invites' as any, {
      filter: {
        inviter: { _eq: me },
        expires_at: { _null: true },
        contact: { _null: true },
        target_email: { _null: true },
      } as any,
      fields: ['code'],
      limit: 1,
      sort: ['-date_created'],
    }),
  )) as any[]

  let code: string = existing?.[0]?.code
  if (!code) {
    code = randomBytes(6).toString('base64url') // ~8 url-safe chars
    await directus.request(createItem('cd_invites' as any, { inviter: me, code } as any))
  }

  return { code, url: `${config.public.appUrl}/i/${code}` }
})
