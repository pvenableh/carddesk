/**
 * POST /api/stripe/credits/refund
 * Refund a CardDesk credit purchase — standalone (non-Earnest-org) users only.
 *
 * Mirrors the guard in credits/checkout: Earnest-org users are billed in real
 * Earnest org tokens, so their purchases live in Earnest's `token_purchases` and
 * their refunds are managed there (Organization → AI & Tokens). They never have
 * a cd_credit_purchases row to refund.
 *
 * Self-service: a standalone user refunds their own purchase (they have no org,
 * so there is no org-admin to gate on).
 *
 * Ordering mirrors Earnest's /api/ai/manage/refund-purchase — refund → mark →
 * deduct — so the worst-case failure favors the customer (they keep some credits)
 * rather than double-deducting. The `status='refunded'` flip is the retry guard.
 *
 * Body: { purchaseId }
 */
import { readItem, updateItem } from '@directus/sdk'
import { useStripe } from '../../../utils/stripe'
import { resolveBillingContext, removeCreditsFromUser } from '../../../utils/ai-credits'
import { getDirectus } from '../../../utils/directus'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const purchaseId = body?.purchaseId as string | undefined
  if (!purchaseId) throw createError({ statusCode: 400, message: 'purchaseId is required' })

  const { userId, orgId } = await resolveBillingContext(event)
  if (orgId) {
    throw createError({
      statusCode: 400,
      message: 'Your team’s AI usage is billed through Earnest — manage token refunds there.',
    })
  }

  const admin = getDirectus()
  const purchase = (await admin
    .request(
      readItem('cd_credit_purchases', purchaseId, {
        fields: ['id', 'user', 'credits', 'amount_cents', 'currency', 'stripe_payment_intent', 'status', 'package_id'],
      }),
    )
    .catch(() => null)) as any

  if (!purchase) throw createError({ statusCode: 404, message: 'Purchase not found' })

  const ownerId = typeof purchase.user === 'object' ? purchase.user?.id : purchase.user
  if (ownerId !== userId) {
    throw createError({ statusCode: 403, message: 'That purchase belongs to another account' })
  }
  if (purchase.status === 'refunded') {
    throw createError({ statusCode: 409, message: 'This purchase has already been refunded' })
  }
  if (!purchase.stripe_payment_intent) {
    throw createError({ statusCode: 400, message: 'No Stripe payment intent on this purchase — refund manually in Stripe.' })
  }

  const stripe = useStripe()

  // 1) Issue the Stripe refund. The idempotency key makes a retry return the
  //    same refund instead of stacking a second one.
  let refund: any = null
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: purchase.stripe_payment_intent,
        reason: 'requested_by_customer',
        metadata: { carddesk_credit_refund: '1', user_id: userId, purchase_id: purchaseId },
      },
      { idempotencyKey: `credit-refund-${purchaseId}` },
    )
  } catch (err: any) {
    if (err?.code !== 'charge_already_refunded') {
      throw createError({ statusCode: err?.statusCode || 502, message: err?.message || 'Stripe refund failed' })
    }
    // Already refunded on Stripe — fall through and reconcile our records.
  }

  // 2) Mark the ledger row refunded (the idempotency guard for retries).
  await admin.request(updateItem('cd_credit_purchases', purchaseId, { status: 'refunded' } as any))

  // 3) Reverse the granted credits (floored at 0).
  const creditsReversed = Number(purchase.credits) || 0
  const newBalance = await removeCreditsFromUser(userId, creditsReversed)

  const amountRefundedCents = refund?.amount ?? purchase.amount_cents ?? 0

  // TODO(email): send a refund receipt. Deliberately not wired here — CardDesk's
  // transactional emails are compiled from MJML in the desktop app and committed
  // as a static asset under server/assets/emails/ (the .mjml source is gitignored;
  // see server/utils/emails/README.md). Adding one needs that design step, so it
  // can't be authored from code alone. NOTE: CardDesk also has no credit PURCHASE
  // receipt today — worth adding both in one pass.

  return {
    success: true,
    refundId: refund?.id ?? null,
    amountRefundedCents,
    creditsReversed,
    newBalance,
  }
})
