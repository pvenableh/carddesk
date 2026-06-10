export interface FeedEvent {
  id: string
  type: string
  payload: Record<string, any>
  date: string
  mine: boolean
  actor: { id: string; name: string }
  reactions: Record<string, number>
  myReactions: string[]
  /** emoji → names of who reacted (current user shown as "You", listed first). */
  reactionUsers: Record<string, string[]>
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
    // Optimistic: one reaction per user. Clicking your current emoji clears it;
    // a different one switches (drop the old, add the new).
    const e = events.value.find((x) => x.id === id)
    if (e) {
      const prev = e.myReactions[0]
      const reactions = { ...e.reactions }
      const who = { ...e.reactionUsers }
      const drop = (em: string) => {
        reactions[em] = Math.max(0, (reactions[em] ?? 0) - 1)
        who[em] = (who[em] ?? []).filter((n) => n !== 'You')
        if (!reactions[em]) delete reactions[em]
      }
      if (prev) drop(prev)
      if (prev === emoji) {
        e.myReactions = []
      } else {
        reactions[emoji] = (reactions[emoji] ?? 0) + 1
        who[emoji] = ['You', ...(who[emoji] ?? []).filter((n) => n !== 'You')]
        e.myReactions = [emoji]
      }
      e.reactions = reactions
      e.reactionUsers = who
    }
    try {
      await $fetch(`/api/feed/${id}/react`, { method: 'POST', body: { emoji } })
    } catch {
      load(true)
    }
  }

  return { events, loading, loaded, load, emit, react }
}
