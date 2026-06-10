import type { CdSession, CdSessionMessage } from '~/types/directus'

/**
 * Earnest AI chat — a single active, continuable conversation rendered by
 * ChatScreen. Each turn hits /api/ai-chat (metered, 1 credit) and the thread is
 * persisted as a `cd_sessions` row of type 'chat' so the user can leave and come
 * back to it later. The first assistant reply creates the session; every reply
 * after that PATCHes it.
 */
export type ChatScope = 'contact' | 'events' | 'score' | 'general'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts?: string
}

export interface OpenChatOptions {
  scope: ChatScope
  title: string
  context?: any
  contactId?: string | null
  /** A canned assistant greeting shown immediately (no API call / no charge). */
  intro?: string
}

const SUGGESTED: Record<ChatScope, string[]> = {
  contact: [
    'What should my next move be with this contact?',
    'Draft a friendly follow-up message I can send.',
    'How do I move them forward in my pipeline?',
  ],
  events: [
    'Analyze my past events — who should I follow up with first?',
    'Which event gave me the best connections?',
    'What patterns do you see across my events?',
  ],
  score: [
    'How do I increase my Earnest Score?',
    'Which dimension should I focus on first?',
    'Give me a plan for this week to improve my score.',
  ],
  general: [
    'How can I get more out of my network?',
    'Who should I reconnect with?',
    'Give me a networking goal for this month.',
  ],
}

export function useChat() {
  const { saveSession, updateSession } = useSessions()
  const { error: showError } = useToast()
  const { loadCredits } = useCredits()

  const scope = useState<ChatScope>('cd-chat-scope', () => 'general')
  const title = useState('cd-chat-title', () => 'Earnest AI')
  const contactId = useState<string | null>('cd-chat-contact', () => null)
  const context = useState<any>('cd-chat-context', () => null)
  const sessionId = useState<string | null>('cd-chat-session', () => null)
  const messages = useState<ChatMessage[]>('cd-chat-messages', () => [])
  const loading = useState('cd-chat-loading', () => false)

  const suggestions = computed(() => SUGGESTED[scope.value] ?? SUGGESTED.general)

  function reset() {
    sessionId.value = null
    messages.value = []
    context.value = null
    contactId.value = null
    loading.value = false
  }

  /** Begin a fresh contextual chat. Does NOT navigate — callers nav('chat'). */
  function open(opts: OpenChatOptions) {
    scope.value = opts.scope
    title.value = opts.title
    context.value = opts.context ?? null
    contactId.value = opts.contactId ?? null
    sessionId.value = null
    loading.value = false
    messages.value = opts.intro
      ? [{ role: 'assistant', content: opts.intro, ts: new Date().toISOString() }]
      : []
  }

  /** Reopen a saved chat session to keep talking. `freshContext` re-grounds it. */
  function resume(session: CdSession, freshContext?: any, scopeHint?: ChatScope) {
    scope.value = scopeHint ?? (session.contact ? 'contact' : 'general')
    title.value = session.title || 'Earnest AI'
    contactId.value = typeof session.contact === 'string'
      ? session.contact
      : (session.contact?.id ?? null)
    context.value = freshContext ?? null
    sessionId.value = session.id
    loading.value = false
    messages.value = (session.messages ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
        ts: m.ts,
      }))
  }

  function toStored(): CdSessionMessage[] {
    return messages.value.map((m) => ({
      role: m.role,
      content: m.content,
      ai_generated: m.role === 'assistant',
      ts: m.ts,
    }))
  }

  function topicSummary(): string {
    const firstUser = messages.value.find((m) => m.role === 'user')
    return (firstUser?.content ?? title.value).slice(0, 140)
  }

  async function persist() {
    try {
      if (sessionId.value) {
        await updateSession(sessionId.value, { messages: toStored(), summary: topicSummary() })
      } else {
        const created = await saveSession({
          type: 'chat',
          contact: contactId.value,
          title: title.value,
          summary: topicSummary(),
          messages: toStored(),
        })
        sessionId.value = created?.id ?? null
      }
    } catch (err) {
      // A failed save shouldn't break the live chat — the user still sees the
      // reply; we just couldn't persist it this turn.
      console.error('[useChat] persist failed:', err)
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading.value) return
    messages.value = [...messages.value, { role: 'user', content, ts: new Date().toISOString() }]
    loading.value = true
    try {
      const { reply } = await $fetch<{ reply: string }>('/api/ai-chat', {
        method: 'POST',
        body: {
          scope: scope.value,
          contactId: contactId.value,
          sessionId: sessionId.value,
          context: context.value,
          messages: messages.value.map((m) => ({ role: m.role, content: m.content })),
        },
      })
      messages.value = [...messages.value, { role: 'assistant', content: reply, ts: new Date().toISOString() }]
      await persist()
      // Keep the credit gauge in sync after a metered turn.
      loadCredits()
    } catch (err: any) {
      // Roll the unanswered user turn back so they can retry cleanly.
      messages.value = messages.value.slice(0, -1)
      if (err?.statusCode === 402 || err?.response?.status === 402) {
        // credit-guard plugin opens the buy modal; no extra toast needed.
      } else {
        showError(err?.data?.message || 'Earnest couldn\'t respond — try again.')
      }
    } finally {
      loading.value = false
    }
  }

  return { scope, title, contactId, context, sessionId, messages, loading, suggestions, open, resume, send, reset }
}
