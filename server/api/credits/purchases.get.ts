/**
 * GET /api/credits/purchases
 * The signed-in user's credit-purchase history (receipts), newest first.
 * Source of truth is cd_credit_purchases (one row per fulfilled Stripe
 * checkout). Standalone (non-Earnest-org) users only — org users are billed
 * through Earnest and have no purchases here, so we return an empty list.
 */
import { readItems } from '@directus/sdk'
import { resolveBillingContext } from '../../utils/ai-credits'
import { getDirectus } from '../../utils/directus'

export default defineEventHandler(async (event) => {
  const { userId, orgId } = await resolveBillingContext(event)
  if (orgId) return { purchases: [] }

  const admin = getDirectus()
  try {
    const rows = (await admin.request(
      readItems('cd_credit_purchases', {
        filter: { user: { _eq: userId } },
        // Only surface completed purchases as receipts; pending/failed rows are
        // internal bookkeeping and would read as confusing "history" entries.
        fields: ['id', 'date_created', 'package_id', 'credits', 'amount_cents', 'currency', 'status'],
        sort: ['-date_created'],
        limit: 50,
      }),
    )) as any[]
    return { purchases: rows ?? [] }
  } catch (err: any) {
    console.error('[GET /api/credits/purchases]', err?.errors ?? err?.message ?? err)
    return { purchases: [] }
  }
})
