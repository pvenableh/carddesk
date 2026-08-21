/**
 * GET /api/notifications — the inbox behind the bell.
 *
 * Every push CardDesk sends a user is recorded here (see cdPushToUser), so a
 * nudge outlives the OS notification that carried it. Read with the admin token
 * and scoped to the session's own user id — a notification is the one thing that
 * must never be readable across accounts.
 */
import { readItems } from '@directus/sdk'
import { getCurrentUserId } from '../../utils/auth'
import { getDirectus } from '../../utils/directus'

export interface CdNotification {
  id: string
  kind: string | null
  title: string
  body: string | null
  url: string | null
  data: Record<string, any> | null
  read_at: string | null
  date_created: string
}

/** Anything older than this is noise; the inbox is a nudge list, not an archive. */
const MAX_AGE_DAYS = 45
const PAGE_SIZE = 40

export default defineEventHandler(async (event): Promise<{ notifications: CdNotification[]; unread: number }> => {
  const userId = await getCurrentUserId(event)
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString()

  const rows = (await getDirectus().request(
    readItems('cd_notifications' as any, {
      filter: { _and: [{ user: { _eq: userId } }, { date_created: { _gte: since } }] } as any,
      fields: ['id', 'kind', 'title', 'body', 'url', 'data', 'read_at', 'date_created'],
      sort: ['-date_created'],
      limit: PAGE_SIZE,
    }),
  )) as CdNotification[]

  return {
    notifications: rows ?? [],
    // Counted off the returned page on purpose: the badge should agree with the
    // list the user is about to open, and 40 unread is already "lots".
    unread: (rows ?? []).filter((n) => !n.read_at).length,
  }
})
