import { getDirectus } from './directus'
import { readItems } from '@directus/sdk'

/**
 * Fetches the latest AI context snapshot from Earnest's Context Broker.
 * The `ai_context_snapshots` collection stores context as a JSON blob in `data`
 * with an explicit `expires_at` timestamp set by the Earnest broker.
 */
export async function getEarnestContext(orgId: string): Promise<string | null> {
  try {
    const directus = getDirectus()
    const snapshots = await directus.request(
      readItems('ai_context_snapshots' as any, {
        filter: { organization: { _eq: orgId } },
        sort: ['-date_created'],
        limit: 1,
        fields: ['data', 'context_type', 'date_created', 'expires_at'],
      }),
    ) as any[]

    if (!snapshots?.length) return null

    const snapshot = snapshots[0]
    if (snapshot.expires_at && new Date(snapshot.expires_at).getTime() < Date.now())
      return null

    if (snapshot.data == null) return null
    return typeof snapshot.data === 'string' ? snapshot.data : JSON.stringify(snapshot.data)
  } catch {
    return null
  }
}

/**
 * Fetches the Earnest Score for an organization. Earnest stores the numeric
 * score in `current_score` and per-dimension breakdowns in `dimension_scores`.
 * The label (Seeker/Builder/Steady/Resolute/Relentless) is derived client-side
 * from score bands so it stays consistent with Earnest's /account page.
 */
export async function getEarnestScore(orgId: string): Promise<{
  current_score: number
  dimension_scores: Record<string, number>
} | null> {
  try {
    const directus = getDirectus()
    const scores = await directus.request(
      readItems('earnest_scores' as any, {
        filter: { organization: { _eq: orgId } },
        sort: ['-date_created'],
        limit: 1,
        fields: ['current_score', 'dimension_scores'],
      }),
    ) as any[]

    if (!scores?.length) return null
    const row = scores[0]
    return {
      current_score: Number(row.current_score ?? 0),
      dimension_scores: row.dimension_scores ?? {},
    }
  } catch {
    return null
  }
}
