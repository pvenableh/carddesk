// Shared Stripe instance factory + CardDesk credit-package catalog.
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function useStripe(): Stripe {
  if (_stripe) return _stripe
  const config = useRuntimeConfig()
  const secretKey =
    process.env.NODE_ENV === 'production'
      ? (config.stripeSecretKeyLive as string)
      : (config.stripeSecretKeyTest as string)
  if (!secretKey) throw createError({ statusCode: 500, message: 'Stripe secret key is not configured' })
  _stripe = new Stripe(secretKey, { apiVersion: '2024-10-28.acacia', maxNetworkRetries: 2 })
  return _stripe
}

/**
 * One-time credit packages for standalone (non-Earnest-org) users. Priced for
 * a consumer audience. Credits are the user-facing unit (see CREDIT_COSTS in
 * ai-credits.ts) — e.g. a 5-credit scan or a 1-credit suggestion.
 */
export const CREDIT_PACKAGES = [
  { id: 'credits_100', name: 'Quick Refill', credits: 100, priceInCents: 500 },
  { id: 'credits_300', name: 'Power Pack', credits: 300, priceInCents: 1200, bestValue: false },
  { id: 'credits_750', name: 'Closer Pack', credits: 750, priceInCents: 2500, bestValue: true },
] as const

export type CreditPackageId = (typeof CREDIT_PACKAGES)[number]['id']

export function findCreditPackage(id: string) {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null
}
