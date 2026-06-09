/**
 * POST /api/stripe/credits/checkout
 * Creates a Stripe Checkout Session for a one-time CardDesk credit package.
 * Standalone (non-Earnest-org) users only — org users top up in Earnest.
 *
 * Body: { packageId, successUrl?, cancelUrl? }
 * Returns: { sessionId, url }
 */
import { updateItem } from '@directus/sdk'
import { useStripe, findCreditPackage } from '../../../utils/stripe'
import { resolveBillingContext, getOrCreateCreditAccount } from '../../../utils/ai-credits'
import { getDirectus } from '../../../utils/directus'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const pkg = findCreditPackage(body?.packageId)
  if (!pkg) throw createError({ statusCode: 400, message: 'Invalid package' })

  const { userId, orgId } = await resolveBillingContext(event)
  if (orgId) {
    throw createError({
      statusCode: 400,
      message: 'Your team’s AI usage is billed through Earnest — top up tokens there.',
    })
  }

  const session = await getUserSession(event)
  const email = (session as any)?.user?.email as string | undefined

  const stripe = useStripe()
  const admin = getDirectus()

  // Shared find-or-create — single source of truth for the account row.
  const account = await getOrCreateCreditAccount(userId)
  let customerId: string | null = account.stripe_customer_id

  if (!customerId) {
    let customer: string | null = null
    if (email) {
      // Escape backslashes/quotes so a `"` in the local part can't break the
      // Stripe search query (which is wrapped in double quotes).
      const safeEmail = email.replace(/[\\"]/g, '\\$&')
      const existing = await stripe.customers.search({ query: `email:"${safeEmail}"` })
      customer = existing.data[0]?.id ?? null
    }
    if (!customer) {
      const created = await stripe.customers.create({
        email: email || undefined,
        metadata: { source: 'carddesk_credits', user_id: userId },
      })
      customer = created.id
    }
    customerId = customer
    await admin.request(updateItem('cd_credit_accounts', account.id, { stripe_customer_id: customerId }))
  }

  const appUrl = (useRuntimeConfig().public.appUrl as string) || 'http://localhost:3000'
  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    // Embedded checkout: the payment form renders inside CardDesk (no redirect
    // to Stripe's hosted page). On completion Stripe returns to our own
    // return_url, which /account confirms.
    ui_mode: 'embedded',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `CardDesk Credits — ${pkg.name}`,
            description: `${pkg.credits} AI credits`,
          },
          unit_amount: pkg.priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: 'credit_purchase',
      package_id: pkg.id,
      credits: String(pkg.credits),
      user_id: userId,
    },
    return_url:
      body?.returnUrl || `${appUrl}/account?credits_purchased=true&session_id={CHECKOUT_SESSION_ID}`,
  })

  return { sessionId: checkout.id, clientSecret: checkout.client_secret }
})
