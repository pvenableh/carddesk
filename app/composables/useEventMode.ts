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
  // Whether the Event Mode panel (a slide-up sheet over the app shell, same
  // pattern as the Earnest chat) is open. The *mode* can stay active with the
  // panel closed — that's what the app-wide EventPill is for.
  const panelOpen = useState('cd-event-panel', () => false)
  // Cached list of past event sessions for the "recent events" history.
  const pastEvents = useState<CdSession[]>('cd-event-past', () => [])
  // When the live event was resumed from history, this holds that snapshot's id
  // so ending it UPDATES the existing record instead of creating a duplicate.
  const resumedSessionId = useState<string | null>('cd-event-resumed', () => null)

  const { contacts } = useContacts()
  const { saveSession, listSessions, updateSession, deleteSession } = useSessions()

  // Everyone tagged with this event's name — the people met here.
  const captured = computed(() =>
    name.value ? contacts.value.filter((c) => c.met_at === name.value && !c.hibernated) : []
  )
  const count = computed(() => captured.value.length)

  // Every distinct "where we met" value across the network — the real list of
  // events the user has, derived from the source of truth (`met_at`) rather than
  // the snapshot log, so it includes events that were never formally "ended".
  // The live event is always surfaced first; the rest are ordered by how many
  // people carry the tag. Powers the Where-We-Met picker on Add/Detail.
  const knownPlaces = computed(() => {
    const counts = new Map<string, number>()
    for (const c of contacts.value) {
      const m = (c.met_at || '').trim()
      if (m) counts.set(m, (counts.get(m) || 0) + 1)
    }
    const live = name.value.trim()
    if (active.value && live && !counts.has(live)) counts.set(live, 0)
    return [...counts.entries()]
      .map(([place, n]) => ({ name: place, count: n, active: active.value && place === live }))
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1
        if (b.count !== a.count) return b.count - a.count
        return a.name.localeCompare(b.name)
      })
  })

  /**
   * Rename an event everywhere it lives: re-tag every contact carrying the old
   * `met_at` (the membership link), retitle any saved history snapshot, and
   * update the live event name if it's the one being renamed. Because membership
   * is a string match, this is what actually moves people between events.
   */
  async function renameEvent(oldName: string, newName: string): Promise<void> {
    const nn = (newName || '').trim()
    if (!nn || nn === oldName) return
    // One bulk Directus call re-tags every attendee, then we patch local state
    // to match (no full refetch needed).
    await $fetch('/api/contacts/retag-event', { method: 'POST', body: { oldName, newName: nn } })
    contacts.value = contacts.value.map((c) => ((c.met_at || '') === oldName ? { ...c, met_at: nn } : c))
    const snaps = pastEvents.value.filter((s) => s.title === oldName)
    await Promise.all(snaps.map((s) => updateSession(s.id, { title: nn }).catch(() => null)))
    pastEvents.value = pastEvents.value.map((s) => (s.title === oldName ? { ...s, title: nn } : s))
    if (active.value && name.value === oldName) name.value = nn
  }

  /**
   * Remove an event's history snapshot. Contacts keep their `met_at` tag — they
   * were still met there — so this deletes the log, not the relationships.
   */
  async function deleteEvent(sessionId: string): Promise<void> {
    await deleteSession(sessionId)
    pastEvents.value = pastEvents.value.filter((s) => s.id !== sessionId)
  }

  function start(eventName: string) {
    name.value = (eventName || '').trim() || 'My Event'
    startedAt.value = new Date().toISOString()
    active.value = true
    // A fresh start is not a resume — clear any stale link so it saves as new.
    resumedSessionId.value = null
  }

  /**
   * Resume a past event: re-activate the mode under its name and remember the
   * snapshot so ending updates that record rather than spawning a duplicate.
   * Preserves the original start time for the saved history.
   */
  function resume(session: CdSession) {
    start(session.title)
    resumedSessionId.value = session.id
    const origStart = (session.messages?.[0]?.content as any)?.started_at
    if (origStart) startedAt.value = origStart
  }

  function end() {
    active.value = false
  }

  function openPanel() {
    panelOpen.value = true
  }

  function closePanel() {
    panelOpen.value = false
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
    const evName = name.value
    active.value = false
    if (!evName) { resumedSessionId.value = null; return null }

    // A resumed event (or one re-using an existing event's name — same `met_at`,
    // so the same people) updates its snapshot instead of spawning a duplicate.
    const existing =
      pastEvents.value.find((s) => s.id === resumedSessionId.value) ||
      pastEvents.value.find((s) => s.title === evName)

    const summary: EventSummary = {
      name: evName,
      started_at: (existing?.messages?.[0]?.content as any)?.started_at || startedAt.value || new Date().toISOString(),
      ended_at: new Date().toISOString(),
      count: snapshotContacts.length,
      contacts: snapshotContacts,
    }
    const summaryText = `${summary.count} ${summary.count === 1 ? 'connection' : 'connections'}`
    const messages = [{ role: 'assistant' as const, content: summary, ts: summary.ended_at }]

    try {
      if (existing) {
        const updated = await updateSession(existing.id, { title: evName, summary: summaryText, messages })
        pastEvents.value = [updated, ...pastEvents.value.filter((s) => s.id !== existing.id)]
        return updated
      }
      const session = await saveSession({ type: 'event', contact: null, title: evName, summary: summaryText, messages })
      pastEvents.value = [session, ...pastEvents.value]
      return session
    } catch (err) {
      // Don't block the user from leaving the event over a failed log write —
      // but say so. The contacts stay tagged via met_at either way.
      console.error('[eventMode] Failed to save event session:', err)
      useToast().error("Couldn't save this event to history — your contacts are still tagged to it.")
      return null
    } finally {
      resumedSessionId.value = null
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

  return { active, name, startedAt, panelOpen, captured, count, pastEvents, knownPlaces, start, resume, end, openPanel, closePanel, saveAndEnd, loadPastEvents, renameEvent, deleteEvent }
}
