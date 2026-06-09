export interface CreditPackage {
  id: string
  name: string
  credits: number
  priceInCents: number
  bestValue?: boolean
}

interface CreditsState {
  loaded: boolean
  source: 'user' | 'org' | null
  unlimited: boolean
  credits: number
  creditsUsed: number
  tokenBalance: number | null
  tokenLimit: number | null
  tokensUsed: number
  grantPending: boolean
  packages: CreditPackage[]
}

const DEFAULT: CreditsState = {
  loaded: false, source: null, unlimited: false,
  credits: 0, creditsUsed: 0,
  tokenBalance: null, tokenLimit: null, tokensUsed: 0,
  grantPending: false, packages: [],
}

export interface CreditRewardToast {
  added: number
  labels: string[]
}

export function useCredits() {
  const state = useState<CreditsState>('cd_credits', () => ({ ...DEFAULT }))
  const showBuyModal = useState<boolean>('cd_buy_modal', () => false)
  const purchasing = useState<string | null>('cd_credits_purchasing', () => null)
  const rewardToast = useState<CreditRewardToast | null>('cd_credit_reward', () => null)
  const analytics = useAnalytics()

  async function loadCredits() {
    try {
      const data = await $fetch<Partial<CreditsState>>('/api/credits')
      state.value = { ...state.value, ...data, loaded: true }
    } catch {
      state.value.loaded = true
    }
  }

  function openBuyModal() { showBuyModal.value = true }
  function closeBuyModal() { showBuyModal.value = false; purchasing.value = null }

  /**
   * Start a credit purchase. Returns the Stripe Checkout client secret for the
   * embedded checkout (the modal mounts it in-app — no redirect). Leaves
   * `purchasing` set so the modal can show the mounted form; reset on close.
   */
  async function purchase(packageId: string): Promise<string | null> {
    purchasing.value = packageId
    const pkg = state.value.packages.find((p) => p.id === packageId)
    if (pkg) analytics.beginCheckout(pkg)
    try {
      const { clientSecret } = await $fetch<{ clientSecret: string | null }>('/api/stripe/credits/checkout', {
        method: 'POST', body: { packageId },
      })
      return clientSecret
    } catch (err) {
      purchasing.value = null
      throw err
    }
  }

  /** Called on the success redirect to credit the balance immediately. */
  async function confirmPurchase(sessionId: string) {
    try {
      const res = await $fetch<{
        fulfilled: boolean; credits: number; newBalance?: number
        amountCents?: number; currency?: string
      }>('/api/stripe/credits/confirm', { method: 'POST', body: { sessionId } })
      // Fire the GA4 `purchase` conversion once per redirect (the /account page
      // clears the query after confirming, so a refresh won't re-fire it).
      if (res && res.credits > 0) {
        analytics.purchase({
          transactionId: sessionId,
          credits: res.credits,
          amountCents: res.amountCents,
          currency: res.currency,
        })
      }
      await loadCredits()
      return res
    } catch {
      return null
    }
  }

  /**
   * Claim any newly-earned credit rewards (server-validated, one-time each).
   * Safe to call opportunistically — after saving a session, leaving feedback,
   * or on app load. Surfaces a celebratory toast when credits are granted.
   */
  async function claimRewards() {
    try {
      const res = await $fetch<{ totalAdded: number; granted: { label: string }[] }>(
        '/api/credits/claim', { method: 'POST' },
      )
      if (res?.totalAdded > 0) {
        rewardToast.value = { added: res.totalAdded, labels: res.granted.map((g) => g.label) }
        await loadCredits()
        setTimeout(() => { rewardToast.value = null }, 4500)
      }
      return res
    } catch {
      return null
    }
  }

  const isOrg = computed(() => state.value.source === 'org')
  const lowBalance = computed(() => state.value.source === 'user' && state.value.credits <= 5)

  // Avatar credit gauge: fill fraction + urgency level/colour. Org users with
  // no hard limit (or unlimited) read as a full green ring.
  const gaugePct = computed(() => {
    const s = state.value
    if (s.source === 'org') {
      if (s.unlimited || s.tokenLimit == null || s.tokenLimit <= 0) return 1
      return Math.max(0, Math.min(1, (s.tokenBalance ?? 0) / s.tokenLimit))
    }
    return Math.max(0, Math.min(1, s.credits / 100)) // 100 ≈ a healthy top-up
  })
  const gaugeLevel = computed<'ok' | 'low' | 'critical'>(() => {
    const s = state.value
    if (s.source === 'org') {
      if (s.unlimited || s.tokenLimit == null || s.tokenLimit <= 0) return 'ok'
      if (gaugePct.value <= 0.05) return 'critical'
      if (gaugePct.value <= 0.2) return 'low'
      return 'ok'
    }
    if (s.credits <= 5) return 'critical'
    if (s.credits <= 20) return 'low'
    return 'ok'
  })
  // Explicit traffic-light colours — not var(--cd-accent), which is near-white
  // in the dark theme and wouldn't read as "healthy".
  const gaugeColor = computed(() =>
    gaugeLevel.value === 'critical' ? '#ef4444' : gaugeLevel.value === 'low' ? '#f59e0b' : '#16c784',
  )

  return {
    state, showBuyModal, purchasing, rewardToast,
    loadCredits, openBuyModal, closeBuyModal, purchase, confirmPurchase, claimRewards,
    isOrg, lowBalance, gaugePct, gaugeLevel, gaugeColor,
  }
}
