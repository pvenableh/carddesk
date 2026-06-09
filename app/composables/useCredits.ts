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

  async function loadCredits() {
    try {
      const data = await $fetch<Partial<CreditsState>>('/api/credits')
      state.value = { ...state.value, ...data, loaded: true }
    } catch {
      state.value.loaded = true
    }
  }

  function openBuyModal() { showBuyModal.value = true }
  function closeBuyModal() { showBuyModal.value = false }

  /** Redirect to Stripe Checkout for a credit package. */
  async function purchase(packageId: string) {
    purchasing.value = packageId
    try {
      const { url } = await $fetch<{ url: string }>('/api/stripe/credits/checkout', {
        method: 'POST', body: { packageId },
      })
      if (url) window.location.href = url
    } catch (err) {
      purchasing.value = null
      throw err
    }
  }

  /** Called on the success redirect to credit the balance immediately. */
  async function confirmPurchase(sessionId: string) {
    try {
      const res = await $fetch<{ fulfilled: boolean; credits: number; newBalance?: number }>(
        '/api/stripe/credits/confirm', { method: 'POST', body: { sessionId } },
      )
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

  return {
    state, showBuyModal, purchasing, rewardToast,
    loadCredits, openBuyModal, closeBuyModal, purchase, confirmPurchase, claimRewards,
    isOrg, lowBalance,
  }
}
