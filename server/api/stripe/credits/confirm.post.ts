/**
 * POST /api/stripe/credits/confirm
 * Success-page fulfillment for a credit purchase. Idempotent with the webhook —
 * whichever fires first credits the balance; the other is a no-op. Lets the UI
 * reflect the new balance immediately and covers local dev without webhooks.
 *
 * Body: { sessionId }
 */
import { useStripe } from '../../../utils/stripe'
import { fulfillCreditCheckout } from '../../../utils/credit-fulfillment'
import { resolveBillingContext } from '../../../utils/ai-credits'

export default defineEventHandler(async (event) => {
  const { sessionId } = await readBody(event)
  if (!sessionId) throw createError({ statusCode: 400, message: 'sessionId is required' })

  // Authenticate, and bind the fulfillment to the calling user.
  const { userId } = await resolveBillingContext(event)

  const stripe = useStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.metadata?.user_id && session.metadata.user_id !== userId) {
    throw createError({ statusCode: 403, message: 'This checkout session is not yours' })
  }

  return await fulfillCreditCheckout(session)
})
