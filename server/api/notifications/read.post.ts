/**
 * POST /api/notifications/read — mark one notification read, or all of them.
 *
 * Body: `{ id }` for a single row, `{ all: true }` for the inbox. Each update is
 * filtered by the session's user id as well as the key, so a guessed id from
 * another account changes nothing.
 */
import { readItems, updateItem } from '@directus/sdk'
import { getCurrentUserId } from '../../utils/auth'
import { getDirectus } from '../../utils/directus'

export default defineEventHandler(async (event): Promise<{ updated: number }> => {
  const userId = await getCurrentUserId(event)
  const body = await readBody<{ id?: string; all?: boolean }>(event).catch(() => ({}))
  const now = new Date().toISOString()
  const directus = getDirectus()

  const targets = body?.all
    ? ((await directus.request(
        readItems('cd_notifications' as any, {
          filter: { _and: [{ user: { _eq: userId } }, { read_at: { _null: true } }] } as any,
          fields: ['id'],
          limit: 200,
        }),
      )) as { id: string }[])
    : body?.id
      // Ownership is checked by reading it back under the user filter first —
      // updateItem alone would happily write to someone else's row.
      ? ((await directus.request(
          readItems('cd_notifications' as any, {
            filter: { _and: [{ user: { _eq: userId } }, { id: { _eq: body.id } }] } as any,
            fields: ['id'],
            limit: 1,
          }),
        )) as { id: string }[])
      : []

  let updated = 0
  for (const row of targets) {
    try {
      await directus.request(updateItem('cd_notifications' as any, row.id, { read_at: now } as any))
      updated++
    } catch (err) {
      console.error('[notifications] mark read failed', row.id, err)
    }
  }
  return { updated }
})
