import type { CdSession } from '~/types/directus'

/**
 * Event Mode — a focused "I'm at a networking event" mode. While active, every
 * contact you capture is auto-tagged with the event name (`met_at`), so the live
 * count and the "people you met here" list derive straight from your data (and
 * stay tagged forever). Designed for rapid, low-friction capture: scan → next.
 *
 * When an event wraps, we persist a lightweight snapshot as a `cd_sessions`
 * record (type `'event'`) so the user keeps a browsable history — name, when it
 * ran, how many people, and who — even as those contacts move through the
 * pipeline later. The contacts themselves stay tagged via `met_at`, so the
 * snapshot is a convenience log, not the source of truth.
 */
export interface EventSummary {
  name: string
  started_at: string
  ended_at: string
  count: number
  contacts: { id: string; name: string; company?: string | null; title?: string | null }[]
}

export function useEventMode() {
  const active = useState('cd-event-active', () => false)
  const name = useState('cd-event-name', () => '')
  const startedAt = useState('cd-event-started', () => '')
  // Cached list of past event sessions for the "recent events" history.
  const pastEvents = useState<CdSession[]>('cd-event-past', () => [])

  const { contacts } = useContacts()
  const { saveSession, listSessions } = useSessions()

  // Everyone tagged with this event's name — the people met here.
  const captured = computed(() =>
    name.value ? contacts.value.filter((c) => c.met_at === name.value && !c.hibernated) : []
  )
  const count = computed(() => captured.value.length)

  function start(eventName: string) {
    name.value = (eventName || '').trim() || 'My Event'
    startedAt.value = new Date().toISOString()
    active.value = true
  }

  function end() {
    active.value = false
  }

  /**
   * Persist the current event as a session snapshot and turn the mode off.
   * Returns the saved session, or null if there was nothing to save / the save
   * failed (callers should still treat the event as ended either way).
   */
  async function saveAndEnd(): Promise<CdSession | null> {
    const snapshotContacts = captured.value.map((c) => ({
      id: c.id, name: c.name, company: c.company ?? null, title: c.title ?? null,
    }))
    const summary: EventSummary = {
      name: name.value,
      started_at: startedAt.value || new Date().toISOString(),
      ended_at: new Date().toISOString(),
      count: snapshotContacts.length,
      contacts: snapshotContacts,
    }
    active.value = false
    if (!name.value) return null
    try {
      const session = await saveSession({
        type: 'event',
        contact: null,
        title: name.value,
        summary: `${summary.count} ${summary.count === 1 ? 'connection' : 'connections'}`,
        messages: [{ role: 'assistant', content: summary, ts: summary.ended_at }],
      })
      pastEvents.value = [session, ...pastEvents.value]
      return session
    } catch (err) {
      // Don't block the user from leaving the event over a failed log write —
      // but say so. The contacts stay tagged via met_at either way.
      console.error('[eventMode] Failed to save event session:', err)
      useToast().error("Couldn't save this event to history — your contacts are still tagged to it.")
      return null
    }
  }

  async function loadPastEvents(): Promise<void> {
    try {
      const all = await listSessions({ scope: 'general' })
      pastEvents.value = (all || []).filter((s) => s.type === 'event')
    } catch (err) {
      console.error('[eventMode] Failed to load past events:', err)
    }
  }

  return { active, name, startedAt, captured, count, pastEvents, start, end, saveAndEnd, loadPastEvents }
}
