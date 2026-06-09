import { readItems, readUsers } from '@directus/sdk'
import { getDirectus } from '../../utils/directus'
import { getCurrentUserId } from '../../utils/auth'

/**
 * Directory search for connecting with other CardDesk users. ONLY returns users
 * who opted in via `discoverable = true`. Excludes the caller and anyone they
 * already have a connection edge with (pending or accepted). Matches name/email.
 */
export default defineEventHandler(async (event) => {
  const me = await getCurrentUserId(event)
  const q = String(getQuery(event).q ?? '').trim()
  if (q.length < 2) return { results: [] }

  const admin = getDirectus()

  // Users I already have an edge with — don't surface them as "connect" targets.
  const edges = (await admin.request(
    readItems('cd_connections' as any, {
      filter: { _or: [{ requester: { _eq: me } }, { addressee: { _eq: me } }] } as any,
      fields: ['requester', 'addressee'],
      limit: 500,
    }),
  )) as any[]
  const exclude = new Set<string>([me])
  for (const e of edges) {
    exclude.add(typeof e.requester === 'object' ? e.requester?.id : e.requester)
    exclude.add(typeof e.addressee === 'object' ? e.addressee?.id : e.addressee)
  }

  const users = (await admin.request(
    readUsers({
      filter: {
        discoverable: { _eq: true },
        status: { _eq: 'active' },
        id: { _nin: Array.from(exclude) },
        _or: [
          { email: { _icontains: q } },
          { first_name: { _icontains: q } },
          { last_name: { _icontains: q } },
        ],
      } as any,
      fields: ['id', 'first_name', 'last_name', 'title', 'avatar'],
      limit: 12,
    }),
  )) as any[]

  return {
    results: users.map((u) => ({
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'CardDesk user',
      title: u.title ?? null,
      avatar: u.avatar ?? null,
    })),
  }
})
