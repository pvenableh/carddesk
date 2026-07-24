import type { PipelineStage } from '~/types/directus'

/**
 * Cross-app pipeline mapping (CardDesk ⇄ Earnest).
 *
 * Once a card is promoted (its `earnest_lead_id` is set) for an Earnest-org
 * user, the Earnest `leads.stage` is the SINGLE source of truth. CardDesk keeps
 * its friendlier six-stage vocabulary in the UI; these maps translate between
 * the two. Standalone / non-Earnest cards never touch a lead and keep their own
 * `pipeline_stage`.
 *
 * Decisions (2026-07): opportunity → qualified; client → won; partner has no
 * lead equivalent (it's a non-sales graduation).
 */

/** Earnest leads.stage values. */
export type LeadStage =
  | 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiating' | 'won' | 'lost'

/**
 * CardDesk stage → Earnest lead stage. `null` = no lead equivalent (partner).
 * Lossy by design: leads has finer mid-stages that all collapse from
 * `opportunity`.
 */
export const CARD_TO_LEAD: Record<PipelineStage, LeadStage | null> = {
  new: 'new',
  warming: 'contacted',
  opportunity: 'qualified',
  client: 'won',
  partner: null,
  lost: 'lost',
}

/**
 * Earnest lead stage → CardDesk stage, for reflecting the canonical lead stage
 * back into CardDesk. The three active mid-stages collapse to `opportunity`, so
 * an Earnest-side move between them doesn't churn the card.
 */
export const LEAD_TO_CARD: Record<LeadStage, PipelineStage> = {
  new: 'new',
  contacted: 'warming',
  qualified: 'opportunity',
  proposal_sent: 'opportunity',
  negotiating: 'opportunity',
  won: 'client',
  lost: 'lost',
}

/** Map a lead stage to its CardDesk bucket (null if unknown/absent). */
export function leadStageToCard(stage?: string | null): PipelineStage | null {
  if (!stage) return null
  return LEAD_TO_CARD[stage as LeadStage] ?? null
}
