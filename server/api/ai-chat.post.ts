/**
 * POST /api/ai-chat — conversational Earnest AI. Powers the continuable chat
 * sessions surfaced from contacts, event history, and the Earnest Score.
 *
 * Billing & margin protection: charged a flat 1 credit per turn (see
 * CREDIT_COSTS['ai-chat']). Because every turn re-sends the conversation, a
 * naive implementation's cost would grow with thread length. We bound it two
 * ways so 1 credit stays profitable on long threads:
 *   1. Only the last HISTORY_WINDOW messages are sent to the model (older turns
 *      are summarised into the system prompt by the client's `summary`).
 *   2. Output is capped at MAX_OUTPUT_TOKENS.
 * Worst case ≈ (system+context ~1.4k + window ~3.7k) input + 0.7k output
 * ≈ 2.5¢/turn on Sonnet, vs. a credit worth 3.3–5¢ → margin stays positive.
 */
import Anthropic from '@anthropic-ai/sdk'
import { getValidToken } from '../utils/auth'
import { fetchUserProfile } from '../utils/profile'
import { getEarnestContext } from '../utils/earnest-context'
import { enforceCredits, chargeCredits } from '../utils/ai-credits'
import { CLAUDE_MODELS } from '../utils/ai-models'
import { logAnthropicError } from '../utils/ai-errors'
import { EARNEST_VOICE_CHARTER } from '../utils/voice'

const MODEL = CLAUDE_MODELS.default
const MAX_OUTPUT_TOKENS = 700
// Last N messages sent to the model. Keeps per-turn input (and cost) bounded
// regardless of how long the conversation grows.
const HISTORY_WINDOW = 10

type ChatScope = 'contact' | 'events' | 'score' | 'general'

interface InboundMessage {
  role: 'user' | 'assistant'
  content: string
}

const BASE_PERSONA = `You are Earnest, a warm, sharp networking coach inside the CardDesk app — a gamified CRM for professionals who meet people and want to turn those contacts into real relationships and revenue.

Voice: encouraging but direct, concrete, never fluffy. Talk like a smart friend who's great at networking, not a corporate chatbot. Keep replies tight — a few short paragraphs or a compact bullet list. Use the person's own data; never invent contacts, numbers, or events. When you give advice, make it specific and immediately actionable (exact next step, what to say, when). Plain text with simple markdown (**bold**, "- " bullets) only — no headings or code blocks.`

function scopeInstructions(scope: ChatScope): string {
  switch (scope) {
    case 'contact':
      return `Focus: helping the user advance THIS one relationship — follow-ups, what to say, timing, how to move them through the pipeline.`
    case 'events':
      return `Focus: helping the user get ROI from the networking events they've worked — who to follow up with first, patterns across events, and how to turn event contacts into relationships.`
    case 'score':
      return `Focus: helping the user raise their Earnest Score. Explain what's dragging each dimension down in plain language and give concrete, prioritised actions they can take this week. Be honest about what moves the needle most.`
    default:
      return `Focus: general networking and CRM coaching tailored to the user's data.`
  }
}

function buildUserBlock(profile: any): string {
  if (!profile) return ''
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  const org = profile.organization
  const bits: string[] = []
  if (name) bits.push(`Name: ${name}`)
  if (profile.title) bits.push(`Role: ${profile.title}`)
  if (org?.name) bits.push(`Company: ${org.name}`)
  if (profile.industry || org?.industry) bits.push(`Industry: ${profile.industry || org.industry}`)
  if (profile.location || org?.address) bits.push(`Location: ${profile.location || org.address}`)
  let block = bits.length ? `\n\nAbout the user:\n- ${bits.join('\n- ')}` : ''
  // The networking goal is the user's north star — surface it prominently so
  // every reply is steered toward advancing what they're actually trying to do.
  if (profile.networking_goal && String(profile.networking_goal).trim()) {
    block += `\n\nThe user's stated networking goal (tailor your help to advancing this): "${String(profile.networking_goal).trim()}"`
  }
  return block
}

function buildContextBlock(scope: ChatScope, context: any): string {
  if (!context) return ''
  try {
    // Context is intentionally small (summaries, not raw dumps) — the client
    // sends only what each surface needs, which also keeps token cost bounded.
    return `\n\nHere is the user's relevant data (the source of truth — use it, don't guess):\n${JSON.stringify(context).slice(0, 4000)}`
  } catch {
    return ''
  }
}

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event)
  const body = await readBody(event)

  const config = useRuntimeConfig()
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: 'Anthropic API key not configured' })

  const scope: ChatScope = ['contact', 'events', 'score', 'general'].includes(body?.scope)
    ? body.scope
    : 'general'

  const incoming: InboundMessage[] = Array.isArray(body?.messages) ? body.messages : []
  const messages = incoming
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
  if (!messages.length || messages[messages.length - 1].role !== 'user')
    throw createError({ statusCode: 400, message: 'A user message is required' })

  // Gate on credits before doing any paid work (throws 402 when depleted).
  const account = await enforceCredits(event, 'ai-chat')

  // Earnest org context, if this user belongs to an org (best-effort).
  let earnestContext = ''
  let profile: any = null
  try {
    profile = await fetchUserProfile(token)
    const orgId = profile?.organization?.id
    if (orgId) {
      const ctx = await getEarnestContext(String(orgId))
      if (ctx) earnestContext = `\n\nEarnest Business Context (org-level):\n${ctx}`
    }
  } catch { /* proceed without */ }

  const summary: string = typeof body?.summary === 'string' && body.summary.trim()
    ? `\n\nEarlier in this conversation (summary): ${body.summary.trim()}`
    : ''

  // What the user is looking at right now — keeps Earnest anchored to the page /
  // content in front of them (passed by each surface that opens the chat).
  const focus: string = typeof body?.focus === 'string' && body.focus.trim()
    ? `\n\nRight now the user is focused on: ${body.focus.trim()}. Anchor your help here unless they steer elsewhere.`
    : ''

  const system =
    `${BASE_PERSONA}\n\n${EARNEST_VOICE_CHARTER}\n\n${scopeInstructions(scope)}` +
    buildUserBlock(profile) +
    focus +
    buildContextBlock(scope, body?.context) +
    summary +
    earnestContext

  // Sliding window — only the most recent turns reach the model. Anthropic
  // requires the first message to be a 'user' turn, so drop any leading
  // assistant messages (e.g. the UI's canned intro greeting, or an assistant
  // turn left at the head after windowing).
  let windowed = messages.slice(-HISTORY_WINDOW)
  while (windowed.length && windowed[0].role === 'assistant') windowed = windowed.slice(1)
  if (!windowed.length) windowed = [messages[messages.length - 1]]

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: windowed,
    })
    chargeCredits(account, {
      model: MODEL,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      contactId: body?.contactId ?? null,
      sessionId: body?.sessionId ?? null,
      metadata: { scope, turns: messages.length },
    })
    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('')
      .trim()
    if (!reply) throw createError({ statusCode: 422, message: 'Earnest had nothing to say — try rephrasing.' })
    return {
      reply,
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    const detail = logAnthropicError('ai-chat', err)
    throw createError({ statusCode: 502, message: `Earnest AI is unavailable right now: ${detail}` })
  }
})
