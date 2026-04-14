import type { CdContact, PipelineStage } from '~/types/directus'

export const PIPELINE_STAGES: { key: PipelineStage; label: string; emoji: string; lucide: string }[] = [
  { key: 'new', label: 'New', emoji: '🆕', lucide: 'lucide:plus-circle' },
  { key: 'contacted', label: 'Contacted', emoji: '📨', lucide: 'lucide:send' },
  { key: 'qualified', label: 'Qualified', emoji: '✅', lucide: 'lucide:check-circle' },
  { key: 'proposal_sent', label: 'Proposal', emoji: '📄', lucide: 'lucide:file-text' },
  { key: 'negotiating', label: 'Negotiating', emoji: '🤝', lucide: 'lucide:handshake' },
  { key: 'won', label: 'Won', emoji: '🏆', lucide: 'lucide:trophy' },
  { key: 'lost', label: 'Lost', emoji: '❌', lucide: 'lucide:x-circle' },
]

export const LOST_REASONS = [
  'Budget',
  'Timing',
  'Competitor',
  'No response',
  'Other',
] as const

export const PIPELINE_XP: Partial<Record<PipelineStage, number>> = {
  contacted: 10,
  qualified: 15,
  proposal_sent: 20,
  negotiating: 25,
  won: 150,
}

export const LOST_REASON_XP = 10

export function usePipeline() {
  const { contacts, updateContact, logActivity } = useContacts()
  const { earn } = useXp()

  async function moveToStage(
    contactId: string,
    stage: PipelineStage,
    metadata?: { lost_reason?: string; estimated_value?: number },
  ) {
    const contact = contacts.value.find((c) => c.id === contactId)
    if (!contact) return

    const oldStage = contact.pipeline_stage
    const payload: Partial<CdContact> = { pipeline_stage: stage }
    if (metadata?.estimated_value !== undefined) payload.estimated_value = metadata.estimated_value
    if (metadata?.lost_reason) payload.lost_reason = metadata.lost_reason

    await updateContact(contactId, payload as any)

    // Log stage change activity
    const stageLabel = PIPELINE_STAGES.find((s) => s.key === stage)?.label ?? stage
    const fromLabel = oldStage ? (PIPELINE_STAGES.find((s) => s.key === oldStage)?.label ?? oldStage) : 'none'
    await logActivity({
      contact: contactId,
      type: 'stage_change',
      label: `Moved to ${stageLabel}`,
      date: new Date().toISOString().slice(0, 10),
      note: `Pipeline: ${fromLabel} → ${stageLabel}${metadata?.lost_reason ? ` (${metadata.lost_reason})` : ''}`,
    } as any)

    // Award XP for pipeline progression
    const xpAmount = PIPELINE_XP[stage]
    if (xpAmount) {
      const emoji = PIPELINE_STAGES.find((s) => s.key === stage)?.emoji ?? '📊'
      earn(xpAmount, emoji, `Moved to ${stageLabel}`)
    }

    // Award XP for logging a lost reason
    if (stage === 'lost' && metadata?.lost_reason) {
      earn(LOST_REASON_XP, '📝', 'Lost reason logged')
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

    // Stalled deals: in a stage >7 days with no activity
    const stalledContacts = active.filter((c) => {
      if (!c.pipeline_stage || c.pipeline_stage === 'won' || c.pipeline_stage === 'lost') return false
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

  return { moveToStage, getPipelineStats, getContactsByStage, getStageInfo, PIPELINE_STAGES, LOST_REASONS }
}
