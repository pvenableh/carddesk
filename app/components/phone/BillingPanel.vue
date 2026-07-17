<script setup lang="ts">
/**
 * Billing & Credits panel — the account "Billing" tab. One place for balance &
 * totals, buying credits, AI usage over time, and a receipt history of past
 * purchases. Standalone users buy flat credits here; Earnest-org users see their
 * team token plan (billed through Earnest, no purchase here).
 *
 * Self-contained (drop it in a tab). Handles the Stripe post-checkout redirect
 * (?credits_purchased) so a purchase confirms and updates the balance + receipts
 * in place.
 */
const route = useRoute()
const router = useRouter()
const { state, loadCredits, openBuyModal, confirmPurchase, isOrg } = useCredits()

onMounted(() => {
  if (!state.value.loaded) loadCredits()
  loadPurchases()
})

const priceLabel = (cents: number) =>
  `$${((cents ?? 0) / 100).toFixed((cents ?? 0) % 100 === 0 ? 0 : 2)}`
const fmt = (n: number) => (n ?? 0).toLocaleString()

// ── Purchase history (receipts) ──
interface Purchase {
  id: string
  date_created: string
  package_id?: string | null
  credits: number
  amount_cents: number
  currency: string
  status: 'paid' | 'pending' | 'failed' | 'refunded'
}
const purchases = ref<Purchase[]>([])
const purchasesLoading = ref(true)
async function loadPurchases() {
  purchasesLoading.value = true
  try {
    const res = await $fetch<{ purchases: Purchase[] }>('/api/credits/purchases')
    purchases.value = res?.purchases ?? []
  } catch {
    purchases.value = []
  } finally {
    purchasesLoading.value = false
  }
}
const totalSpentCents = computed(() =>
  purchases.value.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount_cents ?? 0), 0),
)
const totalPurchased = computed(() =>
  purchases.value.filter((p) => p.status === 'paid').reduce((s, p) => s + (p.credits ?? 0), 0),
)
function purchaseDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Refunds (standalone users only — org users are billed through Earnest) ──
// Refunds the Stripe charge and reverses the purchase's credits (floored at 0).
const refundTarget = ref<Purchase | null>(null)
const refundLoading = ref(false)
const refundError = ref<string | null>(null)

async function confirmRefund() {
  const p = refundTarget.value
  if (!p || refundLoading.value) return
  refundLoading.value = true
  refundError.value = null
  try {
    await $fetch('/api/stripe/credits/refund', {
      method: 'POST',
      body: { purchaseId: p.id },
    })
    refundTarget.value = null
    await Promise.all([loadPurchases(), loadCredits()])
  } catch (err: any) {
    refundError.value = err?.data?.message || err?.message || 'Could not issue the refund.'
  } finally {
    refundLoading.value = false
  }
}

// ── Post-checkout confirmation (Stripe returns to /account?tab=billing) ──
const purchaseBanner = ref<string | null>(null)
onMounted(async () => {
  if (route.query.credits_purchased === 'true' && typeof route.query.session_id === 'string') {
    const res = await confirmPurchase(route.query.session_id)
    purchaseBanner.value = res?.credits
      ? `🎉 ${res.credits} credits added — you're topped up.`
      : 'Purchase received — your credits will appear shortly.'
    router.replace({ query: { tab: 'billing' } })
    await loadPurchases()
    setTimeout(() => (purchaseBanner.value = null), 6000)
  }
})

function buy(packageId?: string) {
  openBuyModal(packageId)
}
</script>

<template>
  <div class="bl-panel">
    <div v-if="purchaseBanner" class="bl-banner">{{ purchaseBanner }}</div>

    <div class="bl-grid">
      <!-- ─────────── LEFT: balance + buy ─────────── -->
      <div class="bl-col">
        <!-- Balance hero -->
        <section class="bl-card bl-balance">
          <template v-if="isOrg">
            <div class="bl-balance-lbl"><CdIcon emoji="⚡" icon="lucide:zap" :size="14" /> Earnest AI · Team plan</div>
            <div class="bl-balance-big">
              {{ state.unlimited || state.tokenBalance == null ? 'Unlimited' : fmt(state.tokenBalance) }}
              <span v-if="!state.unlimited && state.tokenBalance != null" class="bl-balance-unit">tokens left</span>
            </div>
            <p class="bl-balance-note">
              Your team’s AI usage is billed through Earnest. Manage your plan and top up tokens in your
              Earnest account.
            </p>
            <div v-if="!state.unlimited && state.tokenLimit" class="bl-meter">
              <div class="bl-meter-fill" :style="{ width: Math.min(100, ((state.tokenBalance ?? 0) / state.tokenLimit) * 100) + '%' }"></div>
            </div>
            <div v-if="!state.unlimited && state.tokenLimit" class="bl-balance-sub">
              {{ fmt(state.tokensUsed) }} used this period · {{ fmt(state.tokenLimit) }} / month
            </div>
          </template>

          <template v-else>
            <div class="bl-balance-lbl"><CdIcon emoji="⚡" icon="lucide:zap" :size="14" /> Earnest AI credits</div>
            <div class="bl-balance-big">
              {{ fmt(state.credits) }} <span class="bl-balance-unit">credits</span>
            </div>
            <p class="bl-balance-note">Credits power card scans, coaching, insights &amp; lead suggestions. They never expire.</p>
            <button class="bl-buy-cta" type="button" @click="buy()">
              <CdIcon icon="lucide:plus" :size="15" /> Buy credits
            </button>
            <div class="bl-balance-sub">{{ fmt(state.creditsUsed) }} credits used all-time</div>
          </template>
        </section>

        <!-- Package picker (standalone only) -->
        <section v-if="!isOrg" class="bl-card">
          <div class="bl-card-title">Top up</div>
          <div class="bl-packs">
            <button
              v-for="pkg in state.packages"
              :key="pkg.id"
              class="bl-pack"
              :class="{ 'is-best': pkg.bestValue }"
              type="button"
              @click="buy(pkg.id)"
            >
              <span v-if="pkg.bestValue" class="bl-pack-badge">Best value</span>
              <span class="bl-pack-credits">{{ pkg.credits }}</span>
              <span class="bl-pack-credits-lbl">credits</span>
              <span class="bl-pack-name">{{ pkg.name }}</span>
              <span class="bl-pack-price">{{ priceLabel(pkg.priceInCents) }}</span>
            </button>
          </div>
          <p class="bl-packs-foot">One-time purchase · secure checkout by Stripe · credits never expire</p>
        </section>
      </div>

      <!-- ─────────── RIGHT: usage + history ─────────── -->
      <div class="bl-col">
        <!-- AI usage over time -->
        <section class="bl-card">
          <div class="bl-card-title">Usage</div>
          <PhoneUsageCard />
        </section>

        <!-- Purchase history / receipts (standalone only) -->
        <section v-if="!isOrg" class="bl-card">
          <div class="bl-card-title">
            Purchase history
            <span v-if="purchases.length" class="bl-card-title-meta">
              {{ fmt(totalPurchased) }} credits · {{ priceLabel(totalSpentCents) }} total
            </span>
          </div>

          <div v-if="purchasesLoading" class="bl-empty">Loading…</div>
          <div v-else-if="!purchases.length" class="bl-empty">
            <CdIcon icon="lucide:receipt" :size="20" />
            <span>No purchases yet. Your receipts will show up here.</span>
          </div>
          <ul v-else class="bl-receipts">
            <li v-for="p in purchases" :key="p.id" class="bl-receipt">
              <span class="bl-receipt-ic"><CdIcon icon="lucide:zap" :size="15" /></span>
              <div class="bl-receipt-main">
                <div class="bl-receipt-credits">+{{ fmt(p.credits) }} credits</div>
                <div class="bl-receipt-date">{{ purchaseDate(p.date_created) }}</div>
              </div>
              <div class="bl-receipt-amt">
                <div class="bl-receipt-price">{{ priceLabel(p.amount_cents) }}</div>
                <div class="bl-receipt-status" :class="'is-' + p.status">{{ p.status }}</div>
              </div>
              <button
                v-if="p.status === 'paid'"
                type="button"
                class="bl-receipt-refund"
                :disabled="refundLoading"
                @click="refundTarget = p"
              >
                Refund
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <!-- Refund confirmation -->
    <div v-if="refundTarget" class="bl-refund-scrim" @click.self="refundTarget = null">
      <div class="bl-refund-modal" role="dialog" aria-modal="true" aria-label="Confirm refund">
        <div class="bl-refund-title">Refund this purchase?</div>
        <p class="bl-refund-body">
          We’ll refund <strong>{{ priceLabel(refundTarget.amount_cents) }}</strong> to your original payment method and
          remove <strong>{{ fmt(refundTarget.credits) }} credits</strong> from your balance. If you’ve already spent some,
          your balance drops to zero rather than going negative. This can’t be undone.
        </p>
        <p v-if="refundError" class="bl-refund-error">{{ refundError }}</p>
        <div class="bl-refund-actions">
          <button type="button" class="bl-refund-cancel" :disabled="refundLoading" @click="refundTarget = null">
            Cancel
          </button>
          <button type="button" class="bl-refund-confirm" :disabled="refundLoading" @click="confirmRefund">
            {{ refundLoading ? 'Refunding…' : `Refund ${priceLabel(refundTarget.amount_cents)}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bl-panel { min-width: 0; }
.bl-banner {
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--cd-accent);
  background: color-mix(in srgb, var(--cd-accent) 12%, transparent);
  color: var(--cd-text);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}
.bl-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
}
@media (min-width: 900px) {
  .bl-grid { grid-template-columns: 1fr 1fr; gap: 22px; }
}
.bl-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.bl-card {
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
  border-radius: 16px;
  padding: 18px;
}
.bl-card-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--cd-dim);
  margin-bottom: 14px;
}
.bl-card-title-meta {
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--cd-muted);
}
/* ── Balance hero ── */
.bl-balance {
  background: linear-gradient(160deg, color-mix(in srgb, var(--cd-accent) 10%, var(--cd-bg2)), var(--cd-bg2));
  border-color: color-mix(in srgb, var(--cd-accent) 24%, var(--cd-bdr));
}
.bl-balance-lbl {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  color: var(--cd-muted);
  margin-bottom: 6px;
}
.bl-balance-big {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 52px;
  line-height: 1;
  color: var(--cd-text);
  letter-spacing: 0.01em;
}
.bl-balance-unit {
  font-family: 'Barlow', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--cd-muted);
  letter-spacing: 0;
}
.bl-balance-note {
  margin: 10px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--cd-muted);
}
.bl-balance-sub {
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--cd-dim);
  font-variant-numeric: tabular-nums;
}
.bl-buy-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  margin-top: 14px;
  padding: 12px;
  border-radius: 9999px;
  border: none;
  background: var(--cd-accent);
  color: var(--cd-bg);
  font-size: 14px;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
}
.bl-buy-cta:hover { opacity: 0.88; }
.bl-meter {
  height: 6px;
  margin-top: 12px;
  border-radius: 999px;
  background: var(--cd-bdr);
  overflow: hidden;
}
.bl-meter-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cd-accent);
}
/* ── Package picker ── */
.bl-packs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.bl-pack {
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
.bl-pack:hover { border-color: var(--cd-accent); transform: translateY(-2px); }
.bl-pack.is-best { border-color: var(--cd-accent); }
.bl-pack-badge {
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
.bl-pack-credits { font-size: 24px; font-weight: 800; color: var(--cd-text); line-height: 1; }
.bl-pack-credits-lbl {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--cd-muted);
}
.bl-pack-name { margin-top: 6px; font-size: 12px; font-weight: 700; color: var(--cd-text); }
.bl-pack-price { margin-top: 4px; font-size: 14px; font-weight: 800; color: var(--cd-accent); }
.bl-packs-foot {
  margin: 12px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--cd-muted);
}
/* ── Receipts ── */
.bl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 10px;
  text-align: center;
  font-size: 12.5px;
  color: var(--cd-muted);
}
.bl-empty :deep(svg) { color: var(--cd-dim); }
.bl-receipts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.bl-receipt {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--cd-bdr);
}
.bl-receipt:last-child { border-bottom: none; }
.bl-receipt-ic {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--cd-accent) 14%, transparent);
  color: var(--cd-accent);
}
.bl-receipt-main { flex: 1; min-width: 0; }
.bl-receipt-credits { font-size: 14px; font-weight: 800; color: var(--cd-text); }
.bl-receipt-date { font-size: 11.5px; color: var(--cd-dim); margin-top: 1px; }
.bl-receipt-amt { text-align: right; flex-shrink: 0; }
.bl-receipt-price { font-size: 14px; font-weight: 800; color: var(--cd-text); font-variant-numeric: tabular-nums; }
.bl-receipt-status {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 2px;
}
.bl-receipt-status.is-paid { color: var(--cd-green, #16c784); }
.bl-receipt-status.is-pending { color: #f59e0b; }
.bl-receipt-status.is-failed { color: #f87171; }
.bl-receipt-status.is-refunded { color: var(--cd-dim); }

/* ── Refund action + confirmation ── */
.bl-receipt-refund {
  margin-left: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--cd-bdr);
  background: transparent;
  color: var(--cd-dim);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.bl-receipt-refund:hover:not(:disabled) {
  color: #f87171;
  border-color: #f87171;
}
.bl-receipt-refund:disabled { opacity: 0.5; cursor: default; }

.bl-refund-scrim {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
}
.bl-refund-modal {
  width: 100%;
  max-width: 340px;
  padding: 18px;
  border-radius: 16px;
  background: var(--cd-bg2);
  border: 1px solid var(--cd-bdr);
}
.bl-refund-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--cd-text);
  margin-bottom: 8px;
}
.bl-refund-body {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cd-muted);
  margin-bottom: 12px;
}
.bl-refund-error {
  font-size: 12px;
  color: #f87171;
  margin-bottom: 10px;
}
.bl-refund-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.bl-refund-cancel,
.bl-refund-confirm {
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--cd-bdr);
}
.bl-refund-cancel {
  background: transparent;
  color: var(--cd-muted);
}
.bl-refund-confirm {
  background: #f87171;
  border-color: #f87171;
  color: #fff;
}
.bl-refund-cancel:disabled,
.bl-refund-confirm:disabled { opacity: 0.6; cursor: default; }
</style>
