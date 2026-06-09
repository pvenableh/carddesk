import type { CdSession, CdSessionMessage } from '~/types/directus'

export type { CdSession, CdSessionMessage }

export interface SaveSessionInput {
  type: CdSession['type']
  contact?: string | null
  title: string
  summary?: string
  messages: CdSessionMessage[]
  is_pinned?: boolean
}

export interface FeedbackInput {
  contact?: string | null
  session?: string | null
  rating?: 'up' | 'down'
  source?: string
  outcome?: string
  note?: string
}

export function useSessions() {
  const saving = ref(false)

  async function saveSession(input: SaveSessionInput) {
    saving.value = true
    try {
      return await $fetch<CdSession>('/api/sessions', { method: 'POST', body: input })
    } finally {
      saving.value = false
    }
  }

  async function listSessions(opts: { contact?: string; scope?: 'general' } = {}) {
    const query: Record<string, string> = {}
    if (opts.contact) query.contact = opts.contact
    else if (opts.scope) query.scope = opts.scope
    return await $fetch<CdSession[]>('/api/sessions', { query })
  }

  async function deleteSession(id: string) {
    return await $fetch(`/api/sessions/${id}`, { method: 'DELETE' })
  }

  async function sendFeedback(input: FeedbackInput) {
    return await $fetch('/api/feedback', { method: 'POST', body: input })
  }

  return { saving, saveSession, listSessions, deleteSession, sendFeedback }
}
