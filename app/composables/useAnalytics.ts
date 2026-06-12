/**
 * Centralized GA4 event tracking. Every analytics call funnels through one
 * guarded entrypoint so call sites stay terse and consistent.
 *
 * - No-ops on the server and whenever gtag isn't ready (dev/preview run with
 *   nuxt-gtag disabled, or an ad-blocker stripped the script) — analytics must
 *   never break, slow, or throw inside a user flow.
 * - Event names follow GA4 snake_case. Reserved GA4 names (`sign_up`, `login`,
 *   `share`, `begin_checkout`, `add_payment_info`, `purchase`) reuse Google's
 *   semantics so they light up the standard funnels and ecommerce reports.
 *
 * Call `useAnalytics()` synchronously at the top of a composable/component
 * setup; the returned helpers close over `gtag` and are safe to fire later
 * from async handlers.
 */
export function useAnalytics() {
  const { gtag } = useGtag()

  function track(event: string, params: Record<string, any> = {}) {
    if (!import.meta.client) return
    try {
      gtag('event', event, params)
    } catch {
      /* gtag missing/blocked — swallow so the user flow is never affected */
    }
  }

  return {
    track,

    // ── Auth ──────────────────────────────────────────────────────────────
    signUp: (method = 'email') => track('sign_up', { method }),
    login: (method = 'email') => track('login', { method }),
    logout: () => track('logout'),
    passwordResetRequest: () => track('password_reset_request'),
    passwordResetComplete: () => track('password_reset_complete'),
    inviteAccept: () => track('invite_accept'),

    // ── Cards & contacts ─────────────────────────────────────────────────
    cardScanStart: (sides: number) => track('card_scan_start', { sides }),
    cardScanSuccess: (sides: number) => track('card_scan_success', { sides }),
    cardScanFailed: (sides: number) => track('card_scan_failed', { sides }),
    contactCreate: (source = 'manual') => track('contact_create', { source }),
    activityLog: (type: string) => track('activity_log', { activity_type: type }),
    contactResponded: () => track('contact_responded'),

    // ── Pipeline ─────────────────────────────────────────────────────────
    pipelineMove: (from: string, to: string) =>
      track('pipeline_stage_move', { from_stage: from, to_stage: to }),
    pipelineGraduate: (goal: string, reason?: string, value?: number) =>
      track('pipeline_graduate', { goal, reason: reason ?? 'unspecified', value: value ?? 0, currency: 'USD' }),
    pipelineLost: (reason?: string) =>
      track('pipeline_lost', { reason: reason ?? 'unspecified' }),

    // ── Sharing & network ────────────────────────────────────────────────
    share: (contentType: string, method: string) =>
      track('share', { content_type: contentType, method }),
    inviteRedeem: () => track('invite_redeem'),

    // ── AI features ──────────────────────────────────────────────────────
    aiFeatureUse: (feature: string) => track('ai_feature_use', { feature }),

    // ── Monetization (GA4 ecommerce funnel) ──────────────────────────────
    beginCheckout: (pkg: { id: string; credits: number; priceInCents: number }) =>
      track('begin_checkout', {
        currency: 'USD',
        value: pkg.priceInCents / 100,
        items: [
          {
            item_id: pkg.id,
            item_name: `${pkg.credits} credits`,
            price: pkg.priceInCents / 100,
            quantity: 1,
          },
        ],
      }),
    addPaymentInfo: (valueCents: number, currency = 'USD') =>
      track('add_payment_info', { value: valueCents / 100, currency: currency.toUpperCase() }),
    checkoutFailed: (reason: string) => track('checkout_submit_failed', { reason }),
    purchase: (opts: { transactionId: string; credits: number; amountCents?: number; currency?: string }) =>
      track('purchase', {
        transaction_id: opts.transactionId,
        value: (opts.amountCents ?? 0) / 100,
        currency: (opts.currency ?? 'usd').toUpperCase(),
        items: [{ item_name: `${opts.credits} credits`, quantity: 1 }],
      }),
  }
}
