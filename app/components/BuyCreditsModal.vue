<script setup lang="ts">
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js'

const { state, showBuyModal, pendingPackage, purchasing, loadCredits, closeBuyModal, purchase } = useCredits()
const config = useRuntimeConfig()
const analytics = useAnalytics()

const error = ref<string | null>(null)
const mode = ref<'select' | 'pay'>('select')
let embedded: StripeEmbeddedCheckout | null = null

// Reset (and tear down the Stripe iframe) whenever the modal closes.
watch(showBuyModal, (open) => {
  if (open) {
    if (!state.value.loaded) loadCredits()
    // Opened for a specific pack (e.g. a package card on /billing) → jump
    // straight into that pack's checkout instead of re-showing the picker.
    const pre = pendingPackage.value
    pendingPackage.value = null
    if (pre) choose(pre)
  } else {
    resetCheckout()
  }
})

function resetCheckout() {
  mode.value = 'select'
  error.value = null
  if (embedded) { try { embedded.destroy() } catch { /* already gone */ } embedded = null }
}

function priceLabel(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

async function choose(packageId: string) {
  error.value = null
  const pk = config.public.stripePublishableKey as string
  if (!pk) { error.value = 'Checkout isn’t configured yet (missing Stripe publishable key).'; return }
  try {
    const clientSecret = await purchase(packageId)
    if (!clientSecret) { error.value = 'Could not start checkout — try again.'; return }
    mode.value = 'pay'
    await nextTick()
    const stripe = await loadStripe(pk)
    if (!stripe) { error.value = 'Could not load checkout.'; resetCheckout(); return }
    embedded = await stripe.createEmbeddedCheckoutPage({
      clientSecret,
      // Surface Stripe's in-iframe checkout funnel to GA4 (we can't see inside
      // the iframe otherwise). Maps to standard ecommerce funnel events.
      onAnalyticsEvent: (e) => {
        if (e.eventType === 'checkoutSubmitted') {
          analytics.addPaymentInfo(e.details.amount ?? 0, e.details.currency ?? 'usd')
        } else if (e.eventType === 'checkoutSubmitFailed') {
          analytics.checkoutFailed(e.details.failureReason ?? 'unexpected')
        }
      },
    })
    embedded.mount('#cd-embedded-checkout')
  } catch (err: any) {
    // Tear down without clearing the message so the user sees what failed.
    if (embedded) { try { embedded.destroy() } catch { /* */ } embedded = null }
    mode.value = 'select'
    error.value = err?.message ?? err?.data?.message ?? 'Could not start checkout — try again.'
  }
}

onBeforeUnmount(resetCheckout)
</script>

<template>
  <Transition name="cd-buy-fade">
    <div v-if="showBuyModal" class="cd-buy-overlay" @click.self="closeBuyModal">
      <div class="cd-buy-sheet" role="dialog" aria-label="Buy Earnest AI credits">
        <button class="cd-buy-close" type="button" aria-label="Close" @click="closeBuyModal">
          <CdIcon emoji="✕" icon="lucide:x" />
        </button>

        <h2 class="cd-buy-title">Fuel your Earnest AI</h2>
        <p class="cd-buy-sub">
          Credits power card scans, coaching, insights, and lead suggestions.
          <span v-if="state.source === 'user'">You have <strong>{{ state.credits }}</strong> left.</span>
        </p>

        <div v-if="mode === 'select'" class="cd-buy-grid">
          <button
            v-for="pkg in state.packages"
            :key="pkg.id"
            class="cd-buy-card"
            :class="{ 'is-best': pkg.bestValue }"
            type="button"
            :disabled="!!purchasing"
            @click="choose(pkg.id)"
          >
            <span v-if="pkg.bestValue" class="cd-buy-badge">Best value</span>
            <span class="cd-buy-credits">{{ pkg.credits }}</span>
            <span class="cd-buy-credits-label">credits</span>
            <span class="cd-buy-name">{{ pkg.name }}</span>
            <span class="cd-buy-price">
              <template v-if="purchasing === pkg.id">…</template>
              <template v-else>{{ priceLabel(pkg.priceInCents) }}</template>
            </span>
          </button>
        </div>

        <!-- Embedded Stripe checkout (in-app, no redirect) -->
        <div v-show="mode === 'pay'">
          <div id="cd-embedded-checkout" class="cd-embedded"></div>
          <button class="cd-buy-back" type="button" @click="resetCheckout">← Choose a different pack</button>
        </div>

        <p v-if="error" class="cd-buy-error">{{ error }}</p>
        <p v-if="mode === 'select'" class="cd-buy-foot">One-time purchase · credits never expire</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cd-buy-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}
.cd-buy-sheet {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  padding: 24px 20px calc(env(safe-area-inset-bottom, 12px) + 20px);
  box-shadow: 0 -12px 48px rgba(0, 0, 0, 0.5);
}
@media (min-width: 480px) {
  .cd-buy-overlay { align-items: center; }
  .cd-buy-sheet { border-bottom: 1px solid var(--cd-bdr); border-radius: 20px; }
}
.cd-buy-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--cd-bdr);
  background: var(--cd-bg);
  color: var(--cd-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cd-buy-title {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 800;
  color: var(--cd-text);
}
.cd-buy-sub {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cd-muted);
}
.cd-buy-sub strong { color: var(--cd-text); }
.cd-buy-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.cd-buy-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 18px 8px 14px;
  border-radius: 14px;
  border: 1.5px solid var(--cd-bdr);
  background: var(--cd-bg);
  cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
}
.cd-buy-card:hover:not(:disabled) {
  border-color: var(--cd-accent);
  transform: translateY(-2px);
}
.cd-buy-card:disabled { opacity: 0.6; cursor: default; }
.cd-buy-card.is-best { border-color: var(--cd-accent); }
.cd-buy-badge {
  position: absolute;
  top: -9px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--cd-accent);
  color: var(--cd-bg);
}
.cd-buy-credits {
  font-size: 24px;
  font-weight: 800;
  color: var(--cd-text);
  line-height: 1;
}
.cd-buy-credits-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--cd-muted);
}
.cd-buy-name {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--cd-text);
}
.cd-buy-price {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 800;
  color: var(--cd-accent);
}
.cd-embedded {
  max-height: 62vh;
  overflow-y: auto;
  border-radius: 12px;
  /* Stripe's embedded checkout iframe follows the account's Dashboard branding
     (the API exposes no per-session theme). Frame it as a clean inset card with
     its own background + padding so it reads as deliberate against the themed
     sheet in either light or dark mode, rather than a bare flash of white. */
  background: var(--cd-checkout-surface, #ffffff);
  padding: 8px;
  border: 1px solid var(--cd-bdr);
}
.cd-buy-back {
  display: block;
  margin: 12px auto 0;
  background: none;
  border: none;
  color: var(--cd-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.cd-buy-back:hover { color: var(--cd-accent); }
.cd-buy-error {
  margin: 14px 0 0;
  font-size: 12px;
  color: #f87171;
  text-align: center;
}
.cd-buy-foot {
  margin: 16px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--cd-muted);
}
.cd-buy-fade-enter-active, .cd-buy-fade-leave-active { transition: opacity 0.2s; }
.cd-buy-fade-enter-active .cd-buy-sheet, .cd-buy-fade-leave-active .cd-buy-sheet { transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1); }
.cd-buy-fade-enter-from, .cd-buy-fade-leave-to { opacity: 0; }
.cd-buy-fade-enter-from .cd-buy-sheet, .cd-buy-fade-leave-to .cd-buy-sheet { transform: translateY(100%); }
</style>
