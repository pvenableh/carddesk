/**
 * POST /api/ai-extract-plan — turn an Earnest AI chat reply into a structured
 * "plan of attack": a titled, ordered list of follow-up tasks with channels and
 * concrete day offsets. The client resolves offsets against an anchor date into
 * real due dates and shows them in a review sheet before saving.
 *
 * Why a separate endpoint (not just parsing the chat text): networking advice is
 * written in relative time ("Tuesday night", "wait 4-5 business days"). We force
 * Claude to emit a single tool call with a strict schema so we get clean,
 * machine-usable tasks instead of prose we'd have to scrape.
 *
 * Billing: flat 1 credit (CREDIT_COSTS['ai-extract-plan']). Output is bounded by
 * the tool schema + a small max_tokens, so margin stays positive like ai-chat.
 */
import Anthropic from '@anthropic-ai/sdk'
import { enforceCredits, chargeCredits } from '../utils/ai-credits'

const MODEL = 'claude-sonnet-4-20250514'
const MAX_OUTPUT_TOKENS = 900
const MAX_TASKS = 12

const SYSTEM = `You convert a networking coach's advice into a concrete, saveable plan of follow-up tasks.

You are given one assistant message plus an anchor date (day 0). Extract the discrete actions the user should take and turn each into a task. Rules:
- Resolve all relative timing into a whole-number "offset_days" from the anchor date (day 0 = the anchor). Interpret "business days" as calendar days (4-5 business days ≈ 6-7 calendar days). "Tonight"/"tomorrow morning" = 0 or 1. If a task has no timing, estimate a sensible spacing so steps don't pile up on the same day.
- One action per task. If the advice says to do two things at once on the same channel, keep them separate tasks.
- Pick the best channel for each task: email, linkedin, call, meet, or other.
- "note" is a short, specific reminder of what to say or reference (e.g. "mention the Q4 partnership idea"). Keep it under ~140 chars. Omit if there's nothing specific.
- "title" (task) is an imperative phrase ("Send intro email with a specific ask").
- The plan "title" is a short label for the whole sequence (e.g. "Follow-up sequence" or "<Name> follow-up").
- Set is_plan=false ONLY if the message contains no actionable multi-step sequence (e.g. it's a pure pep-talk or a single vague suggestion). Otherwise true.
- Never invent contacts, events, or facts not present in the message. At most ${MAX_TASKS} tasks.`

const TOOL = {
  name: 'save_plan',
  description: 'Save the extracted plan of attack as structured tasks.',
  input_schema: {
    type: 'object' as const,
    properties: {
      is_plan: {
        type: 'boolean',
        description: 'Whether the message actually contains an actionable multi-step plan worth saving.',
      },
      title: { type: 'string', description: 'Short label for the whole sequence.' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Imperative action phrase.' },
            channel: {
              type: 'string',
              enum: ['email', 'linkedin', 'call', 'meet', 'other'],
              description: 'Best outreach channel for this step.',
            },
            offset_days: {
              type: 'integer',
              description: 'Whole calendar days from the anchor date (day 0) when this task is due.',
            },
            note: { type: 'string', description: 'Optional short specific reminder of what to say/reference.' },
          },
          required: ['title', 'offset_days'],
        },
      },
    },
    required: ['is_plan', 'title', 'tasks'],
  },
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: 'Anthropic API key not configured' })

  const body = await readBody(event)
  const message: string = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) throw createError({ statusCode: 400, message: 'A message to convert is required' })

  const anchor: string =
    typeof body?.anchor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.anchor)
      ? body.anchor.slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  const contactName: string = typeof body?.contactName === 'string' ? body.contactName.trim() : ''

  // Gate on credits before any paid work (throws 402 when depleted).
  const account = await enforceCredits(event, 'ai-extract-plan')

  const userContent =
    `Anchor date (day 0): ${anchor}.` +
    (contactName ? ` This is about a contact named ${contactName}.` : '') +
    `\n\nMessage to convert into a plan:\n"""\n${message.slice(0, 6000)}\n"""`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM,
      tools: [TOOL as any],
      tool_choice: { type: 'tool', name: 'save_plan' },
      messages: [{ role: 'user', content: userContent }],
    })

    chargeCredits(account, {
      model: MODEL,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      contactId: body?.contactId ?? null,
      sessionId: body?.sessionId ?? null,
      metadata: { kind: 'extract-plan' },
    })

    const toolUse = response.content.find((b: any) => b.type === 'tool_use') as any
    const out = toolUse?.input ?? {}
    const rawTasks: any[] = Array.isArray(out.tasks) ? out.tasks : []
    const tasks = rawTasks
      .filter((t) => t?.title && typeof t.title === 'string')
      .slice(0, MAX_TASKS)
      .map((t) => ({
        title: String(t.title).slice(0, 200),
        channel: ['email', 'linkedin', 'call', 'meet', 'other'].includes(t.channel) ? t.channel : null,
        offset_days: Number.isFinite(t.offset_days) ? Math.max(0, Math.round(t.offset_days)) : 0,
        note: typeof t.note === 'string' && t.note.trim() ? t.note.trim().slice(0, 200) : null,
      }))

    return {
      is_plan: out.is_plan !== false && tasks.length > 0,
      title: (typeof out.title === 'string' && out.title.trim()
        ? out.title.trim()
        : contactName
          ? `${contactName} follow-up`
          : 'Plan of attack'
      ).slice(0, 120),
      anchor,
      tasks,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    const detail = err?.error?.error?.message || err?.message || 'unknown error'
    console.error('[ai-extract-plan] Anthropic error:', err?.status ?? err?.statusCode, detail)
    throw createError({ statusCode: 502, message: `Couldn't build a plan right now: ${detail}` })
  }
})
