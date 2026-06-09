/**
 * POST /api/stripe/webhook
 * Stripe webhook — fulfills CardDesk credit purchases on checkout.session.completed.
 * Configure this URL in the Stripe dashboard with the checkout.session.completed event.
 */
import type Stripe from 'stripe'
import { useStripe } from '../../utils/stripe'
import { fulfillCreditCheckout } from '../../utils/credit-fulfillment'

export default defineEventHandler(async (event) => {
  const stripe = useStripe()

  // Stripe signs the RAW bytes — readBody would re-serialize and fail verification.
  const payload = await readRawBody(event, 'utf-8')
  const signature = getHeader(event, 'stripe-signature') || ''
  const config = useRuntimeConfig()
  const secret = (config.stripeWebhookSecret as string) || process.env.STRIPE_WEBHOOK_SECRET || ''

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(payload || '', signature, secret)
  } catch (err: any) {
    console.error('[stripe/webhook] verification failed:', err?.message || err)
    throw createError({ statusCode: 400, message: 'Webhook verification failed' })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    if (session.mode === 'payment' && session.metadata?.type === 'credit_purchase') {
      try {
        const result = await fulfillCreditCheckout(session)
        console.log('[stripe/webhook] credit fulfillment:', JSON.stringify(result))
      } catch (err: any) {
        // Surface a 500 so Stripe retries on a transient DB failure (unique
        // violations are handled inside fulfillCreditCheckout, not thrown).
        console.error('[stripe/webhook] fulfillment error:', err?.message || err)
        throw createError({ statusCode: 500, message: 'Fulfillment failed' })
      }
    }
  }

  return { received: true }
})
