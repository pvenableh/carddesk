import type { CdContact, OpportunityGoal, PipelineStage } from '~/types/directus'

/**
 * The relationship ladder. `group` drives how each stage is surfaced:
 *  - `forward`  → the simple path everyone walks (shown in the Move sheet)
 *  - `graduate` → a finish line reached via the Graduate flow, not a plain move
 *  - `off`      → an off-ramp, tucked away from the forward steps
 */
export const PIPELINE_STAGES: { key: PipelineStage; label: string; emoji: string; lucide: string; group: 'forward' | 'graduate' | 'off' }[] = [
  { key: 'new', label: 'New', emoji: '🆕', lucide: 'lucide:plus-circle', group: 'forward' },
  { key: 'warming', label: 'Warming', emoji: '🔥', lucide: 'lucide:flame', group: 'forward' },
  { key: 'opportunity', label: 'Opportunity', emoji: '🎯', lucide: 'lucide:target', group: 'forward' },
  { key: 'client', label: 'Client', emoji: '💰', lucide: 'lucide:badge-check', group: 'graduate' },
  { key: 'partner', label: 'Partner', emoji: '🤝', lucide: 'lucide:handshake', group: 'graduate' },
  { key: 'lost', label: 'Not now', emoji: '🌙', lucide: 'lucide:moon', group: 'off' },
]

/** The two finish lines a contact can graduate to. */
export const GOAL_OPTIONS: { key: OpportunityGoal; label: string; emoji: string; lucide: string; hint: string }[] = [
  { key: 'client', label: 'Client', emoji: '💰', lucide: 'lucide:briefcase', hint: 'They hire you' },
  { key: 'partner', label: 'Partner', emoji: '🤝', lucide: 'lucide:handshake', hint: 'You trade work' },
]

/** "What sealed it?" chips captured at graduation. */
export const CONVERSION_REASONS = ['Project', 'Contract', 'Referral', 'Retainer', 'Collaboration'] as const

export const LOST_REASONS = [
  'Budget',
  'Timing',
  'Competitor',
  'No response',
  'Other',
] as const

/** Activity types that count as real outreach and auto-advance New → Warming. */
export const OUTREACH_TYPES = ['email', 'text', 'call', 'meeting', 'linkedin'] as const

export const PIPELINE_XP: Partial<Record<PipelineStage, number>> = {
  warming: 10,
  opportunity: 20,
  client: 200,
  partner: 200,
}

export const LOST_REASON_XP = 10

export function usePipeline() {
  const { contacts, updateContact, logActivity } = useContacts()
  const { state: xp, earn, deduct } = useXp()
  const analytics = useAnalytics()

  /**
   * Move a contact along the forward path (new/warming/opportunity) or off-ramp it (lost).
   * Graduating to client/partner goes through `graduate()` instead.
   */
  async function moveToStage(
    contactId: string,
    stage: PipelineStage,
    metadata?: { lost_reason?: string; estimated_value?: number; opportunity_goal?: OpportunityGoal },
  ) {
    const contact = contacts.value.find((c) => c.id === contactId)
    if (!contact) return

    const oldStage = contact.pipeline_stage
    const payload: Partial<CdContact> = { pipeline_stage: stage }
    if (metadata?.estimated_value !== undefined) payload.estimated_value = metadata.estimated_value
    if (metadata?.lost_reason) payload.lost_reason = metadata.lost_reason
    if (metadata?.opportunity_goal) payload.opportunity_goal = metadata.opportunity_goal
    // Note: the goal tag is an independent, optional marker — it persists across
    // stage moves (set/cleared only via the goal chip), so it's never wiped here.

    await updateContact(contactId, payload as any)

    const stageLabel = PIPELINE_STAGES.find((s) => s.key === stage)?.label ?? stage
    const fromLabel = oldStage ? (PIPELINE_STAGES.find((s) => s.key === oldStage)?.label ?? oldStage) : 'none'
    await logActivity({
      contact: contactId,
      type: 'stage_change',
      label: `Moved to ${stageLabel}`,
      date: new Date().toISOString().slice(0, 10),
      note: `Pipeline: ${fromLabel} → ${stageLabel}${metadata?.lost_reason ? ` (${metadata.lost_reason})` : ''}`,
    } as any)

    analytics.pipelineMove(oldStage ?? 'none', stage)
    if (stage === 'lost') analytics.pipelineLost(metadata?.lost_reason)

    const xpAmount = PIPELINE_XP[stage]
    if (xpAmount) {
      const emoji = PIPELINE_STAGES.find((s) => s.key === stage)?.emoji ?? '📊'
      earn(xpAmount, emoji, `Moved to ${stageLabel}`)
    }

    if (stage === 'lost' && metadata?.lost_reason) {
      earn(LOST_REASON_XP, '📝', 'Lost reason logged')
    }
  }

  /** Tag a contact as an Opportunity with its goal (client vs partner). */
  async function setOpportunityGoal(contactId: string, goal: OpportunityGoal) {
    return moveToStage(contactId, 'opportunity', { opportunity_goal: goal })
  }

  /**
   * Set or clear the goal tag on its own — an optional "what am I going for"
   * marker that's independent of stage (no stage move, XP, or activity log).
   */
  async function setGoalTag(contactId: string, goal: OpportunityGoal | null) {
    await updateContact(contactId, { opportunity_goal: goal } as any)
  }

  /**
   * The single graduation path — replaces the old separate "Mark as Client" flow.
   * Sets the terminal stage, flips the matching boolean (is_client / is_partner),
   * stamps the timestamp, records what sealed it, and logs the milestone + XP.
   */
  async function graduate(
    contactId: string,
    goal: OpportunityGoal,
    meta?: { reason?: string; note?: string; estimated_value?: number },
  ) {
    const contact = contacts.value.find((c) => c.id === contactId)
    if (!contact) return

    const now = new Date().toISOString()
    const payload: Partial<CdContact> = {
      pipeline_stage: goal,
      opportunity_goal: goal,
      conversion_reason: meta?.reason,
      conversion_note: meta?.note,
    }
    if (meta?.estimated_value !== undefined) payload.estimated_value = meta.estimated_value
    if (goal === 'client') Object.assign(payload, { is_client: true, client_at: now })
    if (goal === 'partner') Object.assign(payload, { is_partner: true, partner_at: now })

    await updateContact(contactId, payload as any)

    const label = goal === 'client' ? 'Converted to Client' : 'Became a Partner'
    await logActivity({
      contact: contactId,
      type: goal === 'client' ? 'converted_client' : 'converted_partner',
      label,
      date: now.slice(0, 10),
      note: meta?.reason ? `${meta.reason}${meta?.note ? ` — ${meta.note}` : ''}` : (meta?.note || undefined),
    } as any)

    analytics.pipelineGraduate(goal, meta?.reason, meta?.estimated_value ?? contact.estimated_value ?? 0)
    // Bump the client counter (drives the "Closer" badge) when the goal is client.
    const extras = goal === 'client' ? { total_clients: (xp.value.total_clients ?? 0) + 1 } : {}
    earn(PIPELINE_XP[goal] ?? 200, goal === 'client' ? '💰' : '🤝', label, extras)
  }

  /** Undo a graduation — drops the booleans and parks the contact back at Opportunity. */
  async function revertGraduation(contactId: string) {
    const contact = contacts.value.find((c) => c.id === contactId)
    if (!contact) return
    const wasClient = contact.pipeline_stage === 'client' || contact.is_client
    await updateContact(contactId, {
      pipeline_stage: 'opportunity',
      is_client: false,
      client_at: null,
      is_partner: false,
      partner_at: null,
    } as any)
    const extras = wasClient ? { total_clients: Math.max(0, (xp.value.total_clients ?? 1) - 1) } : {}
    deduct(PIPELINE_XP[wasClient ? 'client' : 'partner'] ?? 200, '↩️', 'Back to an active contact', extras)
  }

  /** Auto-advance a fresh contact to Warming the first time real outreach is logged. */
  async function maybeAutoWarm(contactId: string) {
    const contact = contacts.value.find((c) => c.id === contactId)
    if (!contact) return
    if (!contact.pipeline_stage || contact.pipeline_stage === 'new') {
      await moveToStage(contactId, 'warming')
    }
  }

  function getPipelineStats() {
    const active = contacts.value.filter((c) => !c.hibernated)
    const stageCounts: Record<string, number> = {}
    let totalValue = 0

    for (const stage of PIPELINE_STAGES) {
      stageCounts[stage.key] = 0
    }

    for (const c of active) {
      const stage = c.pipeline_stage
      if (stage && stageCounts[stage] !== undefined) {
        stageCounts[stage]++
      }
      if (c.estimated_value && c.pipeline_stage !== 'lost') {
        totalValue += c.estimated_value
      }
    }

    // Stalled: on the forward path >7 days with no activity (terminal stages are settled).
    const stalledContacts = active.filter((c) => {
      const stage = c.pipeline_stage
      if (!stage || stage === 'client' || stage === 'partner' || stage === 'lost') return false
      const acts = (c.activities as any[]) ?? []
      if (!acts.length) return true
      const latest = acts.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b)
      const daysSince = Math.floor((Date.now() - new Date(latest.date).getTime()) / 86_400_000)
      return daysSince > 7
    })

    return { stageCounts, totalValue, stalledCount: stalledContacts.length, stalledContacts }
  }

  function getContactsByStage(): Record<PipelineStage, CdContact[]> {
    const result = {} as Record<PipelineStage, CdContact[]>
    for (const stage of PIPELINE_STAGES) {
      result[stage.key] = []
    }
    for (const c of contacts.value.filter((c) => !c.hibernated)) {
      const stage = c.pipeline_stage
      if (stage && result[stage]) {
        result[stage].push(c)
      }
    }
    return result
  }

  function getStageInfo(stage: PipelineStage) {
    return PIPELINE_STAGES.find((s) => s.key === stage)
  }

  return {
    moveToStage,
    setOpportunityGoal,
    setGoalTag,
    graduate,
    revertGraduation,
    maybeAutoWarm,
    getPipelineStats,
    getContactsByStage,
    getStageInfo,
    PIPELINE_STAGES,
    GOAL_OPTIONS,
    CONVERSION_REASONS,
    LOST_REASONS,
  }
}
