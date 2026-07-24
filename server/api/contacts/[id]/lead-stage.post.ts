/**
 * Write a linked card's stage change THROUGH to its Earnest lead — the single
 * source of truth once a card is promoted (`earnest_lead_id` set) for an
 * Earnest-org user.
 *
 * Maps CardDesk's stage vocabulary to `leads.stage` (see types/pipeline-map),
 * with a downgrade guard: if the lead's current stage already sits in the same
 * CardDesk bucket (e.g. the lead is `negotiating`, which shows as
 * `opportunity`), re-selecting that bucket does NOT drag the lead back to
 * `qualified`. Only a genuine bucket change moves the lead.
 *
 * Non-Earnest / unlinked / stale-link cards return `{ linked: false }` and the
 * client falls back to a plain `pipeline_stage` PATCH — standalone CardDesk
 * users are unaffected.
 *
 * Lead writes use the admin token (the CardDesk user policy can't touch
 * `leads`), mirroring the promote endpoint.
 *
 * Body: { stage: PipelineStage }
 */
import { readItem, updateItem } from '@directus/sdk'
import { getDirectus, getUserDirectus } from '../../../utils/directus'
import { getValidToken } from '../../../utils/auth'
import { resolveBillingContext } from '../../../utils/ai-credits'
import { CARD_TO_LEAD, leadStageToCard } from '~/types/pipeline-map'
import type { PipelineStage } from '~/types/directus'

export default defineEventHandler(async (event) => {
  const cdContactId = getRouterParam(event, 'id')
  if (!cdContactId) throw createError({ statusCode: 400, message: 'cd_contact id required' })

  const body = await readBody<{ stage: PipelineStage }>(event)
  const stage = body?.stage
  if (!stage || !(stage in CARD_TO_LEAD)) {
    throw createError({ statusCode: 400, message: 'valid stage required' })
  }

  const token = await getValidToken(event)
  const { orgId } = await resolveBillingContext(event)
  // Not an Earnest-org user → nothing to sync; the caller writes pipeline_stage.
  if (!orgId) return { linked: false }

  const userDx = getUserDirectus(token)
  const cd: any = await userDx
    .request(readItem('cd_contacts', cdContactId, { fields: ['id', 'earnest_lead_id'] }))
    .catch(() => null)
  const leadId = cd?.earnest_lead_id
  if (!leadId) return { linked: false }

  const admin = getDirectus()
  const lead: any = await admin
    .request(readItem('leads', String(leadId), { fields: ['id', 'stage'] }))
    .catch(() => null)
  // Stale link (lead deleted) — fall back to a local write.
  if (!lead) return { linked: false }

  const target = CARD_TO_LEAD[stage]
  // Partner (no lead equivalent) — leave the lead + the card's local stage as
  // the caller set them; nothing to reflect.
  if (!target) return { linked: true, leadStage: lead.stage, cardStage: stage }

  let finalLeadStage: string = lead.stage
  // Downgrade guard: only move the lead when the CardDesk bucket actually
  // changes (re-selecting the current bucket is a no-op on the lead).
  if (leadStageToCard(lead.stage) !== stage) {
    await admin.request(updateItem('leads', String(leadId), { stage: target } as any))
    finalLeadStage = target
  }

  // Mirror the canonical lead stage onto the card so its cached pipeline_stage
  // matches what the list endpoint reflects.
  const cardStage = leadStageToCard(finalLeadStage) ?? stage
  await userDx
    .request(updateItem('cd_contacts', cdContactId, { pipeline_stage: cardStage } as any))
    .catch(() => {})

  return { linked: true, leadStage: finalLeadStage, cardStage }
})
