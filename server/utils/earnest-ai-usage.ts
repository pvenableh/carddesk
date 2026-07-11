import { createItem, readItems } from '@directus/sdk'
import { getDirectus } from './directus'

/**
 * Cross-app AI-usage attribution: mirror CardDesk's real Anthropic token spend
 * into the SHARED Directus `ai_usage_logs` collection so it rolls up in the
 * Earnest app's per-org "AI & Tokens" floor.
 *
 * `ai_usage_logs` is owned by the Earnest app; CardDesk only ever INSERTS rows
 * (with the shared admin token). This is deliberately separate from
 * ai-credits.ts's `cd_ai_usage_logs` bookkeeping — that collection is
 * CardDesk-private and carries credit accounting; this one is Earnest's rollup
 * source and carries only what that rollup selects.
 *
 * See docs/carddesk-ai-usage-attribution-spec.md (Earnest repo) for the contract.
 */

// Per-model price table (USD per 1M tokens). Kept in sync with Earnest's
// MODEL_PRICING (server/utils/ai-usage.ts) so CardDesk and Earnest costs are
// directly comparable. NOTE: these are Earnest's rollup rates and intentionally
// differ from ai-credits.ts's PRICING, which serves CardDesk's own credit tuning.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 15, output: 75 },
}
// Sonnet-tier default for models not (yet) in the table — mirrors Earnest's
// prefix-match fallback so an unknown model still costs something plausible.
const DEFAULT_PRICING = { input: 3, output: 15 }

function priceFor(model: string): { input: number; output: number } {
  const exact = MODEL_PRICING[model]
  if (exact) return exact
  // Prefix match (e.g. a dated snapshot id) before falling back.
  const hit = Object.keys(MODEL_PRICING).find((m) => model.startsWith(m))
  return (hit && MODEL_PRICING[hit]) || DEFAULT_PRICING
}

/** USD cost, rounded to 6 decimal places (matches Earnest's estimated_cost). */
function estimateCost(model: string, input: number, output: number): number {
  const p = priceFor(model)
  const raw = (input * p.input + output * p.output) / 1_000_000
  return Math.round(raw * 1e6) / 1e6
}

/**
 * Resolve the org a user is billed under from their active membership. Only used
 * as a fallback when the caller couldn't hand us the billed org directly.
 */
async function resolveOrgFromMembership(userId: string): Promise<string | null> {
  try {
    const admin = getDirectus()
    const rows = (await admin.request(
      readItems('org_memberships' as any, {
        filter: { user: { _eq: userId }, status: { _eq: 'active' } },
        fields: ['organization'],
        limit: 1,
      }),
    )) as any[]
    const raw = rows?.[0]?.organization
    return raw != null ? String(raw) : null
  } catch (err: any) {
    console.error('[earnest-ai-usage] membership org lookup failed:', err?.message ?? err)
    return null
  }
}

export interface EarnestAiUsageInput {
  /** Owning org id (the billed org). Primary attribution path — pass it if known. */
  orgId: string | null
  /** Acting user's directus_users id (nullable, used for the "By Member" breakdown). */
  userId: string | null
  /** Exact Anthropic model id used, e.g. `claude-opus-4-8`. */
  model: string
  inputTokens: number
  outputTokens: number
  /** "By Feature" label. Defaults to `carddesk/scan`. */
  endpoint?: string
  sessionId?: string | null
  /** Merged into `metadata` alongside `{ product: 'carddesk' }`. */
  metadata?: Record<string, any>
}

/**
 * Fire-and-forget: write ONE `ai_usage_logs` row for a completed CardDesk AI
 * call so it appears in Earnest's per-org rollup. Never blocks or fails the
 * caller — all work is deferred and errors are swallowed.
 *
 * Org attribution: uses `orgId` (the billed org) when present; otherwise falls
 * back to the user's active org membership. If neither resolves, the row is
 * SKIPPED (not mis-attributed) with a warning.
 */
export function logEarnestAiUsage(input: EarnestAiUsageInput): void {
  void (async () => {
    try {
      let orgId = input.orgId
      if (!orgId && input.userId) {
        orgId = await resolveOrgFromMembership(input.userId)
        if (orgId) {
          console.warn(
            `[earnest-ai-usage] org resolved via membership fallback for user ${input.userId} -> ${orgId}`,
          )
        }
      }
      if (!orgId) {
        // No org => can't appear in any org rollup. Skipping beats mis-attributing.
        console.warn(
          `[earnest-ai-usage] no org for user ${input.userId ?? 'unknown'}; skipping ai_usage_logs row`,
        )
        return
      }

      const input_tokens = input.inputTokens ?? 0
      const output_tokens = input.outputTokens ?? 0
      const total_tokens = input_tokens + output_tokens

      const admin = getDirectus()
      await admin.request(
        createItem('ai_usage_logs' as any, {
          user: input.userId ?? null,
          organization: orgId,
          endpoint: input.endpoint ?? 'carddesk/scan',
          model: input.model,
          input_tokens,
          output_tokens,
          total_tokens,
          estimated_cost: estimateCost(input.model, input_tokens, output_tokens),
          session_id: input.sessionId ?? null,
          metadata: { product: 'carddesk', ...(input.metadata ?? {}) },
        } as any),
      )
    } catch (err: any) {
      console.error('[earnest-ai-usage] log failed:', err?.errors ?? err?.message ?? err)
    }
  })()
}
