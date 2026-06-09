/**
 * POST /api/credits/claim — grant any newly-eligible earn-as-you-go rewards.
 * Server-authoritative + idempotent. Standalone users only (org users bill
 * through Earnest and don't have a credit balance).
 */
import { resolveBillingContext, claimRewards } from '../../utils/ai-credits'

export default defineEventHandler(async (event) => {
  const { userId, orgId } = await resolveBillingContext(event)
  if (orgId) return { granted: [], totalAdded: 0, source: 'org' }
  return await claimRewards(userId)
})
