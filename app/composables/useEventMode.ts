/**
 * Event Mode — a focused "I'm at a networking event" mode. While active, every
 * contact you capture is auto-tagged with the event name (`met_at`), so the live
 * count and the "people you met here" list derive straight from your data (and
 * stay tagged forever). Designed for rapid, low-friction capture: scan → next.
 */
export function useEventMode() {
  const active = useState('cd-event-active', () => false)
  const name = useState('cd-event-name', () => '')
  const startedAt = useState('cd-event-started', () => '')

  const { contacts } = useContacts()

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

  return { active, name, startedAt, captured, count, start, end }
}
