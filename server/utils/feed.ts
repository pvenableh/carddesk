import { readItems, createItem } from '@directus/sdk'
import { getDirectus } from './directus'
import type { FeedEventType } from '~/types/directus'

export const FEED_TYPES: FeedEventType[] = ['card_scanned', 'level_up', 'streak', 'badge', 'connected', 'joined', 'intro']

/**
 * Record a social activity event. Visibility follows the actor's
 * cd_cards.broadcast_activity flag (connections vs private). Best-effort —
 * never throws into the calling flow.
 */
export async function emitFeedEvent(userId: string, type: FeedEventType, payload: Record<string, any> = {}) {
  try {
    const admin = getDirectus()
    const rows = (await admin.request(
      readItems('cd_cards' as any, { filter: { user: { _eq: userId } } as any, fields: ['broadcast_activity'], limit: 1 }),
    )) as any[]
    const broadcast = rows?.[0]?.broadcast_activity ?? true
    await admin.request(
      createItem('cd_feed_events' as any, {
        actor: userId,
        type,
        visibility: broadcast ? 'connections' : 'private',
        payload,
      } as any),
    )
  } catch (err: any) {
    console.warn('[feed] emit failed:', err?.message ?? err)
  }
}
