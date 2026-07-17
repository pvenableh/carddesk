import type { H3Event } from 'h3'
import { readMe, readItem, readItems, createItem, updateItem, updateItems } from '@directus/sdk'
import { getDirectus, getUserDirectus } from './directus'
import { getValidToken } from './auth'
import { CLAUDE_MODELS } from './ai-models'

/**
 * AI credit accounting for CardDesk.
 *
 * Two kinds of users, one ledger:
 *  - Standalone (non-Earnest) users spend a flat per-action CREDIT balance on
 *    cd_credit_accounts. They get a one-time onboarding grant, then must top up.
 *  - Earnest-org users keep Earnest's raw-TOKEN accounting on the organizations
 *    row (ai_token_balance / ai_token_limit_monthly). Credits are recorded for
 *    them too, but they're billed in real tokens via Earnest.
 *
 * Every AI call is gated by enforceCredits() (throws 402 when depleted) and,
 * on success, recorded + deducted by chargeCredits() — fire-and-forget so
 * accounting never blocks or fails the AI response.
 *
 * Concurrency: balances are mutated via optimistic-locked conditional updates
 * (updateItems guarded on the balance being unchanged, retried on a lost race)
 * — Directus has no atomic increment, and a plain read-modify-write would let
 * concurrent calls clobber each other's deductions.
 */

// Flat per-action credit prices — the user-facing cost. Real token usage is
// still recorded in cd_ai_usage_logs so these can be re-tuned without a migration.
export const CREDIT_COSTS = {
  'scan-card': 5, // Opus vision — most expensive
  'ai-suggestions': 1,
  'ai-lead-suggestions': 2,
  'ai-insights': 2,
  'ai-sayings': 2,
  'ai-goal': 1,
  // Conversational Earnest AI (one user turn + reply). Margin is protected by a
  // sliding context window + output cap server-side (see ai-chat.post.ts), so a
  // flat 1 credit stays profitable even on long threads — worst-case ~2.5¢/turn
  // vs. a credit worth 3.3–5¢ depending on the pack.
  'ai-chat': 1,
  // One short drafted message (Reconnect Roulette re-opener) — 300-token output cap.
  'ai-reopener': 1,
  // Daily Vibe pep-talk — cached per-day client-side, so at most one charge/day.
  // (Was missing from this map entirely: cost resolved to undefined, which made
  // `balance < cost` always false — the gate silently passed and charged 0.)
  'ai-daily-vibe': 1,
  // Turn an Earnest chat reply into a structured "plan of attack" (tasks with
  // dates). One short tool-use call with a tight output — flat 1 credit.
  'ai-extract-plan': 1,
} as const

export type AiEndpoint = keyof typeof CREDIT_COSTS

// New standalone users get this many credits on their first AI call.
export const ONBOARDING_CREDIT_GRANT = 25

// Claude pricing per 1M tokens (USD). Used only to record estimated_cost for
// later price tuning — it does not affect deduction.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-5': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
}

function estimateCost(model: string, input: number, output: number): number {
  const p = PRICING[model] ?? PRICING[CLAUDE_MODELS.default]
  return (input * p.input + output * p.output) / 1_000_000
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface CreditAccount {
  userId: string
  endpoint: AiEndpoint
  cost: number
  source: 'user' | 'org'
  orgId: string | null
  creditAccountId: string | null
  unlimited: boolean
}

export interface ChargeUsage {
  model: string
  inputTokens: number
  outputTokens: number
  contactId?: string | null
  sessionId?: string | null
  metadata?: Record<string, any>
}

// ─── Billing context ──────────────────────────────────────────────────────

/**
 * Resolve the signed-in user's id and primary Earnest org (if any). Memoized
 * on the H3 event so repeated calls within one request don't re-hit /users/me.
 */
export async function resolveBillingContext(
  event: H3Event,
): Promise<{ userId: string; orgId: string | null }> {
  const ctx = event.context as any
  if (ctx.cdBilling) return ctx.cdBilling

  const token = await getValidToken(event)
  const userDx = getUserDirectus(token)
  const me = (await userDx.request(
    readMe({ fields: ['id', { organizations: [{ organizations_id: ['id'] }] }] as any }),
  )) as any
  const userId = me?.id
  if (!userId) throw createError({ statusCode: 401, message: 'Not authenticated' })

  let orgId: string | null = null
  if (Array.isArray(me.organizations) && me.organizations.length) {
    const first = me.organizations[0]
    const raw = first?.organizations_id?.id ?? first?.organizations_id ?? null
    orgId = raw != null ? String(raw) : null
  }
  const result = { userId, orgId }
  ctx.cdBilling = result
  return result
}

export interface OrgBilling {
  balance: number | null
  limit: number | null
  used: number
  unlimited: boolean
  depleted: boolean
}

/**
 * Read an Earnest org's token billing state. FAILS CLOSED: an unreadable or
 * missing org throws (503) rather than being treated as unlimited — a transient
 * read error must never silently hand out free, unmetered AI.
 */
export async function getOrgBilling(orgId: string): Promise<OrgBilling> {
  const admin = getDirectus()
  let org: any
  try {
    org = await admin.request(
      readItem('organizations' as any, orgId, {
        fields: ['ai_token_balance', 'ai_token_limit_monthly', 'ai_tokens_used_this_period'],
      }),
    )
  } catch (err: any) {
    console.error('[ai-credits] org billing read failed:', err?.message ?? err)
    throw createError({ statusCode: 503, message: 'Could not verify your team plan — please try again.' })
  }
  if (!org) {
    throw createError({ statusCode: 503, message: 'Could not verify your team plan — please try again.' })
  }
  const balance = org.ai_token_balance ?? null
  const limit = org.ai_token_limit_monthly ?? null
  const used = org.ai_tokens_used_this_period ?? 0
  const unlimited = balance == null && limit == null
  const depleted =
    !unlimited && ((balance != null && balance <= 0) || (limit != null && used >= limit))
  return { balance, limit, used, unlimited, depleted }
}

// ─── Credit-account primitives ──────────────────────────────────────────────

export interface CreditAccountRow {
  id: string
  ai_credit_balance: number
  ai_credits_used_total: number
  ai_credits_used_this_period: number
  free_credits_granted: boolean
  claimed_rewards: string[]
  stripe_customer_id: string | null
}

const ACCOUNT_FIELDS = [
  'id',
  'ai_credit_balance',
  'ai_credits_used_total',
  'ai_credits_used_this_period',
  'free_credits_granted',
  'claimed_rewards',
  'stripe_customer_id',
] as const

function normalizeAccount(r: any): CreditAccountRow {
  return {
    id: r.id,
    ai_credit_balance: r.ai_credit_balance ?? 0,
    ai_credits_used_total: r.ai_credits_used_total ?? 0,
    ai_credits_used_this_period: r.ai_credits_used_this_period ?? 0,
    free_credits_granted: !!r.free_credits_granted,
    claimed_rewards: Array.isArray(r.claimed_rewards) ? r.claimed_rewards : [],
    stripe_customer_id: r.stripe_customer_id ?? null,
  }
}

/** Find-or-create the standalone user's credit account (single source of truth). */
export async function getOrCreateCreditAccount(userId: string): Promise<CreditAccountRow> {
  const admin = getDirectus()
  const rows = (await admin.request(
    readItems('cd_credit_accounts', {
      filter: { user: { _eq: userId } },
      limit: 1,
      fields: ACCOUNT_FIELDS as unknown as string[],
    }),
  )) as any[]
  if (rows?.length) return normalizeAccount(rows[0])

  const created = (await admin.request(
    createItem('cd_credit_accounts', {
      user: userId,
      ai_credit_balance: 0,
      ai_credits_used_total: 0,
      ai_credits_used_this_period: 0,
      free_credits_granted: false,
      claimed_rewards: [],
    } as any),
  )) as any
  return normalizeAccount(created)
}

/**
 * Optimistically apply a balance mutation to a credit account. `compute`
 * receives the freshly-read row and returns the field patch (or null to skip).
 * The write is guarded on ai_credit_balance being unchanged since the read, so
 * a concurrent mutation forces a re-read + recompute rather than a lost update.
 * Every mutation here changes the balance, so the guard is sufficient.
 */
async function adjustCreditAccount(
  accountId: string,
  compute: (row: CreditAccountRow) => Record<string, any> | null,
  attempts = 6,
): Promise<CreditAccountRow | null> {
  const admin = getDirectus()
  for (let i = 0; i < attempts; i++) {
    const rows = (await admin.request(
      readItems('cd_credit_accounts', {
        filter: { id: { _eq: accountId } },
        limit: 1,
        fields: ACCOUNT_FIELDS as unknown as string[],
      }),
    )) as any[]
    const row = rows?.[0] ? normalizeAccount(rows[0]) : null
    if (!row) return null

    const patch = compute(row)
    if (!patch) return row // nothing to change

    const updated = (await admin.request(
      updateItems(
        'cd_credit_accounts',
        { filter: { id: { _eq: accountId }, ai_credit_balance: { _eq: row.ai_credit_balance } } },
        patch,
      ),
    )) as any[]
    if (updated && updated.length) return normalizeAccount({ ...row, ...patch })
    // Lost the race (balance changed) — re-read and retry.
  }
  console.error('[ai-credits] adjustCreditAccount: exhausted retries for', accountId)
  return null
}

/** Optimistically deduct real tokens from an Earnest org (guarded on balance). */
async function adjustOrgTokens(orgId: string, tokens: number, attempts = 6): Promise<void> {
  const admin = getDirectus()
  for (let i = 0; i < attempts; i++) {
    const org = (await admin.request(
      readItem('organizations' as any, orgId, {
        fields: ['ai_token_balance', 'ai_tokens_used_this_period'],
      }),
    )) as any
    const bal = org?.ai_token_balance ?? null
    const used = (org?.ai_tokens_used_this_period ?? 0) + tokens

    if (bal == null) {
      // Limit-only/unlimited org — no balance to guard; best-effort usage bump.
      await admin.request(updateItem('organizations' as any, orgId, { ai_tokens_used_this_period: used }))
      return
    }
    const updated = (await admin.request(
      updateItems(
        'organizations' as any,
        { filter: { id: { _eq: orgId }, ai_token_balance: { _eq: bal } } },
        { ai_token_balance: Math.max(0, bal - tokens), ai_tokens_used_this_period: used },
      ),
    )) as any[]
    if (updated && updated.length) return
  }
  console.error('[ai-credits] adjustOrgTokens: exhausted retries for', orgId)
}

/** Ensure the account exists and the one-time onboarding grant has been applied. */
export async function ensureUserCredits(userId: string): Promise<{ accountId: string; balance: number }> {
  const account = await getOrCreateCreditAccount(userId)
  if (account.free_credits_granted) {
    return { accountId: account.id, balance: account.ai_credit_balance }
  }
  const after = await adjustCreditAccount(account.id, (row) =>
    row.free_credits_granted
      ? null // granted by a concurrent call — don't double-grant
      : {
          ai_credit_balance: row.ai_credit_balance + ONBOARDING_CREDIT_GRANT,
          free_credits_granted: true,
          ai_credit_period_start: todayISO(),
        },
  )
  return {
    accountId: account.id,
    balance: after?.ai_credit_balance ?? account.ai_credit_balance + ONBOARDING_CREDIT_GRANT,
  }
}

// ─── Gate + charge ──────────────────────────────────────────────────────────

/**
 * Gate an AI endpoint. Throws 402 when the relevant balance is depleted (or 503
 * if an org's billing can't be verified). Returns a CreditAccount for chargeCredits().
 */
export async function enforceCredits(event: H3Event, endpoint: AiEndpoint): Promise<CreditAccount> {
  const cost = CREDIT_COSTS[endpoint]
  const { userId, orgId } = await resolveBillingContext(event)

  if (orgId) {
    const billing = await getOrgBilling(orgId) // fails closed on read error
    if (billing.depleted) {
      throw createError({
        statusCode: 402,
        message: 'Your team’s AI tokens are used up. Add more in Earnest to keep using AI features.',
      })
    }
    return { userId, endpoint, cost, source: 'org', orgId, creditAccountId: null, unlimited: billing.unlimited }
  }

  const { accountId, balance } = await ensureUserCredits(userId)
  if (balance < cost) {
    throw createError({
      statusCode: 402,
      message: 'You’re out of Earnest AI credits. Top up to keep using Earnest AI features.',
    })
  }
  return { userId, endpoint, cost, source: 'user', orgId: null, creditAccountId: accountId, unlimited: false }
}

/**
 * Record usage and deduct the balance. Fire-and-forget: a failure here is
 * logged but never blocks or fails the AI response the user already received.
 */
export function chargeCredits(account: CreditAccount, usage: ChargeUsage): void {
  void (async () => {
    try {
      const admin = getDirectus()
      const input = usage.inputTokens ?? 0
      const output = usage.outputTokens ?? 0
      const total = input + output

      await admin.request(
        createItem('cd_ai_usage_logs', {
          user: account.userId,
          endpoint: account.endpoint,
          model: usage.model,
          input_tokens: input,
          output_tokens: output,
          total_tokens: total,
          credits_charged: account.cost,
          estimated_cost: estimateCost(usage.model, input, output),
          billed_to: account.source,
          organization: account.orgId,
          contact: usage.contactId ?? null,
          session_id: usage.sessionId ?? null,
          metadata: usage.metadata ?? null,
        } as any),
      )

      if (account.source === 'user' && account.creditAccountId) {
        await adjustCreditAccount(account.creditAccountId, (row) => ({
          ai_credit_balance: Math.max(0, row.ai_credit_balance - account.cost),
          ai_credits_used_total: row.ai_credits_used_total + account.cost,
          ai_credits_used_this_period: row.ai_credits_used_this_period + account.cost,
        }))
      } else if (account.source === 'org' && account.orgId && !account.unlimited) {
        await adjustOrgTokens(account.orgId, total)
      }
    } catch (err: any) {
      console.error('[ai-credits] charge failed:', err?.errors ?? err?.message ?? err)
    }
  })()
}

/**
 * Add purchased credits to a user's balance (find-or-create their account).
 * Used by Stripe fulfillment. Returns the new balance.
 */
export async function addCreditsToUser(userId: string, credits: number): Promise<number> {
  const account = await getOrCreateCreditAccount(userId)
  const after = await adjustCreditAccount(account.id, (row) => ({
    ai_credit_balance: row.ai_credit_balance + credits,
  }))
  return after?.ai_credit_balance ?? account.ai_credit_balance + credits
}

/**
 * Reverse a credit grant — the refund counterpart of addCreditsToUser.
 * FLOORS AT ZERO: a user who already spent some of a refunded purchase drops to
 * 0 rather than going negative (we don't claw back usage they already had).
 * Returns the new balance.
 */
export async function removeCreditsFromUser(userId: string, credits: number): Promise<number> {
  const account = await getOrCreateCreditAccount(userId)
  const after = await adjustCreditAccount(account.id, (row) => ({
    ai_credit_balance: Math.max(0, row.ai_credit_balance - credits),
  }))
  return after?.ai_credit_balance ?? Math.max(0, account.ai_credit_balance - credits)
}

// ─── Earn-as-you-go rewards ───────────────────────────────────────────────

/**
 * Reward catalog. Eligibility is checked SERVER-SIDE against trustworthy
 * signals only — real cd_sessions / cd_feedback row counts. (Streak/level
 * rewards were intentionally removed: cd_xp_state is written verbatim from the
 * client via POST /api/xp, so granting credits off it was a free-credit hole.)
 * Each reward is granted at most once, tracked in cd_credit_accounts.claimed_rewards.
 */
export const REWARD_CATALOG = [
  { key: 'first_session', amount: 5, label: 'Saved your first session' },
  { key: 'five_sessions', amount: 10, label: 'Saved 5 sessions' },
  { key: 'first_feedback', amount: 5, label: 'Gave your first AI feedback' },
] as const

export interface ClaimResult {
  granted: Array<{ key: string; amount: number; label: string }>
  totalAdded: number
  balance: number
}

/**
 * Grant any newly-eligible, unclaimed rewards to a standalone user. Concurrency-
 * and retry-safe: eligibility is recomputed against the freshly-read
 * claimed_rewards inside the optimistic update, so two concurrent claims can
 * never double-grant the same reward.
 */
export async function claimRewards(userId: string): Promise<ClaimResult> {
  const admin = getDirectus()
  const [sessions, feedback] = (await Promise.all([
    admin.request(readItems('cd_sessions', { filter: { user_created: { _eq: userId } }, limit: 5, fields: ['id'] })),
    admin.request(readItems('cd_feedback', { filter: { user_created: { _eq: userId } }, limit: 1, fields: ['id'] })),
  ])) as any[]
  const sessionCount = sessions.length
  const feedbackCount = feedback.length

  const eligible = (key: string): boolean => {
    switch (key) {
      case 'first_session': return sessionCount >= 1
      case 'five_sessions': return sessionCount >= 5
      case 'first_feedback': return feedbackCount >= 1
      default: return false
    }
  }

  const account = await getOrCreateCreditAccount(userId)
  let granted: Array<{ key: string; amount: number; label: string }> = []

  const after = await adjustCreditAccount(account.id, (row) => {
    const toGrant = REWARD_CATALOG.filter((r) => !row.claimed_rewards.includes(r.key) && eligible(r.key))
    if (!toGrant.length) {
      granted = []
      return null
    }
    granted = toGrant.map((r) => ({ key: r.key, amount: r.amount, label: r.label }))
    const total = toGrant.reduce((s, r) => s + r.amount, 0)
    return {
      ai_credit_balance: row.ai_credit_balance + total,
      claimed_rewards: [...row.claimed_rewards, ...toGrant.map((r) => r.key)],
    }
  })

  const totalAdded = granted.reduce((s, g) => s + g.amount, 0)
  return { granted, totalAdded, balance: after?.ai_credit_balance ?? account.ai_credit_balance }
}
