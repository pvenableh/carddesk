/**
 * GET /api/credits
 * Returns the signed-in user's AI balance + the purchasable packages.
 * Standalone users get a flat credit balance; Earnest-org users see their
 * org token balance (billed through Earnest, not purchasable here).
 */
import { readItems } from '@directus/sdk'
import { resolveBillingContext, getOrgBilling, ensureUserCredits, ONBOARDING_CREDIT_GRANT } from '../../utils/ai-credits'
import { getDirectus } from '../../utils/directus'
import { CREDIT_PACKAGES } from '../../utils/stripe'

export default defineEventHandler(async (event) => {
  const { userId, orgId } = await resolveBillingContext(event)
  const admin = getDirectus()

  if (orgId) {
    // Shares the gate's billing logic. getOrgBilling fails closed (throws) on a
    // read error; for this read-only display endpoint we degrade gracefully
    // instead so the UI shows "team plan" rather than erroring.
    try {
      const billing = await getOrgBilling(orgId)
      return {
        source: 'org' as const,
        unlimited: billing.unlimited,
        tokenBalance: billing.balance,
        tokenLimit: billing.limit,
        tokensUsed: billing.used,
        packages: CREDIT_PACKAGES,
      }
    } catch {
      return {
        source: 'org' as const,
        unlimited: true,
        tokenBalance: null,
        tokenLimit: null,
        tokensUsed: 0,
        unavailable: true,
        packages: CREDIT_PACKAGES,
      }
    }
  }

  // Materialize the one-time onboarding grant if it hasn't been applied yet
  // (idempotent). Heals accounts whose row was created — e.g. by a reward
  // claim — before the grant ran, so a user never sees a stuck 0 balance.
  await ensureUserCredits(userId)

  const rows = (await admin.request(
    readItems('cd_credit_accounts', {
      filter: { user: { _eq: userId } },
      limit: 1,
      fields: ['ai_credit_balance', 'ai_credits_used_total', 'free_credits_granted'],
    }),
  )) as any[]
  const row = rows?.[0]
  // Before the first AI call materializes the row, the onboarding grant is what
  // they effectively have available.
  const credits = row ? (row.ai_credit_balance ?? 0) : ONBOARDING_CREDIT_GRANT
  return {
    source: 'user' as const,
    unlimited: false,
    credits,
    creditsUsed: row?.ai_credits_used_total ?? 0,
    grantPending: !row || !row.free_credits_granted,
    packages: CREDIT_PACKAGES,
  }
})
