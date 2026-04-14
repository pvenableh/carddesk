import { getDirectus } from './directus'
import { readItems } from '@directus/sdk'

/**
 * Fetches the latest AI context snapshot from Earnest's Context Broker.
 * Returns the snapshot text if available and fresh (< 30 min), otherwise null.
 * CardDesk falls back to local context when this returns null.
 */
export async function getEarnestContext(orgId: string): Promise<string | null> {
  try {
    const directus = getDirectus()
    const snapshots = await directus.request(
      readItems('ai_context_snapshots' as any, {
        filter: { organization: { _eq: orgId } },
        sort: ['-date_created'],
        limit: 1,
        fields: ['content', 'date_created'],
      }),
    ) as any[]

    if (!snapshots?.length) return null

    const snapshot = snapshots[0]
    const age = Date.now() - new Date(snapshot.date_created).getTime()
    const THIRTY_MINUTES = 30 * 60 * 1000

    if (age > THIRTY_MINUTES) return null

    return snapshot.content ?? null
  } catch {
    // Collection may not exist yet — gracefully return null
    return null
  }
}

/**
 * Fetches the Earnest Score for an organization.
 * Returns score data or null if unavailable.
 */
export async function getEarnestScore(orgId: string): Promise<{
  total_score: number
  label: string
  dimensions: Record<string, number>
} | null> {
  try {
    const directus = getDirectus()
    const scores = await directus.request(
      readItems('earnest_scores' as any, {
        filter: { organization: { _eq: orgId } },
        sort: ['-date_created'],
        limit: 1,
        fields: ['total_score', 'label', 'dimensions'],
      }),
    ) as any[]

    if (!scores?.length) return null
    return scores[0]
  } catch {
    return null
  }
}
