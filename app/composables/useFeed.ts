export interface FeedEvent {
  id: string
  type: string
  payload: Record<string, any>
  date: string
  mine: boolean
  actor: { id: string; name: string }
  reactions: Record<string, number>
  myReactions: string[]
}

export function useFeed() {
  const events = useState<FeedEvent[]>('cd-feed', () => [])
  const loading = useState('cd-feed-loading', () => false)
  const loaded = useState('cd-feed-loaded', () => false)

  async function load(force = false) {
    if (loading.value || (loaded.value && !force)) return
    loading.value = true
    try {
      const { events: list } = await $fetch<{ events: FeedEvent[] }>('/api/feed')
      events.value = list ?? []
      loaded.value = true
    } catch (err) {
      console.error('[useFeed] load failed:', err)
    } finally {
      loading.value = false
    }
  }

  /** Fire-and-forget activity emit (level-up, badge, scan, streak). */
  function emit(type: string, payload: Record<string, any> = {}) {
    $fetch('/api/feed/emit', { method: 'POST', body: { type, payload } }).catch(() => {})
  }

  async function react(id: string, emoji: string) {
    // optimistic
    const e = events.value.find((x) => x.id === id)
    if (e) {
      const has = e.myReactions.includes(emoji)
      e.myReactions = has ? e.myReactions.filter((x) => x !== emoji) : [...e.myReactions, emoji]
      e.reactions = { ...e.reactions, [emoji]: Math.max(0, (e.reactions[emoji] ?? 0) + (has ? -1 : 1)) }
    }
    try {
      await $fetch(`/api/feed/${id}/react`, { method: 'POST', body: { emoji } })
    } catch {
      load(true)
    }
  }

  return { events, loading, loaded, load, emit, react }
}
