import type Stripe from 'stripe'
import { createItem, deleteItem } from '@directus/sdk'
import { getDirectus } from './directus'
import { addCreditsToUser } from './ai-credits'

export interface FulfillResult {
  fulfilled: boolean
  alreadyFulfilled: boolean
  credits: number
  newBalance?: number
  userId?: string
}

/**
 * Idempotently fulfill a paid credit-purchase checkout session:
 *  - validates payment status + metadata
 *  - records cd_credit_purchases (unique stripe_session_id enforces idempotency
 *    across webhook retries AND the success-page confirm endpoint)
 *  - credits the user's balance exactly once
 *
 * Exactly-once crediting: the purchase row is the idempotency gate (only one
 * insert wins). If crediting then fails, the gate row is removed and the error
 * rethrown — so the webhook returns non-2xx, Stripe retries, the insert wins
 * again, and crediting is reattempted. The row exists only once credit succeeded.
 */
export async function fulfillCreditCheckout(session: Stripe.Checkout.Session): Promise<FulfillResult> {
  if (session.payment_status !== 'paid') return { fulfilled: false, alreadyFulfilled: false, credits: 0 }

  const md = session.metadata || {}
  if (md.type !== 'credit_purchase') return { fulfilled: false, alreadyFulfilled: false, credits: 0 }

  const credits = Number(md.credits)
  const userId = md.user_id
  if (!credits || !userId) return { fulfilled: false, alreadyFulfilled: false, credits: 0 }

  const admin = getDirectus()
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  // Insert the gate row. A duplicate means another path already credited.
  let purchaseId: string
  try {
    const created = (await admin.request(
      createItem('cd_credit_purchases', {
        user: userId,
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntent,
        package_id: md.package_id ?? null,
        credits,
        amount_cents: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        status: 'paid',
      } as any),
    )) as any
    purchaseId = created.id
  } catch (err: any) {
    const msg = JSON.stringify(err?.errors ?? err?.message ?? err)
    if (/unique|duplicate|RECORD_NOT_UNIQUE/i.test(msg)) {
      return { fulfilled: false, alreadyFulfilled: true, credits, userId }
    }
    throw err
  }

  // Credit the balance. If it fails, remove the gate row so a retry re-credits
  // (otherwise the duplicate-insert short-circuit would strand the payment).
  try {
    const newBalance = await addCreditsToUser(userId, credits)
    return { fulfilled: true, alreadyFulfilled: false, credits, newBalance, userId }
  } catch (err: any) {
    try {
      await admin.request(deleteItem('cd_credit_purchases', purchaseId))
    } catch (delErr: any) {
      console.error('[credit-fulfillment] failed to roll back purchase row', purchaseId, delErr?.message ?? delErr)
    }
    throw err
  }
}
