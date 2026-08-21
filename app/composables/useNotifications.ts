/**
 * The notification inbox — the durable half of push.
 *
 * Every push CardDesk sends a user is recorded server-side (see
 * `cdPushToUser`), so the nudge survives the OS notification being swiped away,
 * arriving on a phone that's face-down, or push being off on this device
 * entirely. This is what the bell in the header reads, and what gives the OS
 * app-icon badge a real number to show instead of an optimistic +1.
 *
 * State is app-wide `useState` rather than per-component: the bell, the sheet
 * and the badge must never disagree about the count.
 */
export interface CdNotification {
  id: string
  kind: string | null
  title: string
  body: string | null
  url: string | null
  data: Record<string, any> | null
  read_at: string | null
  date_created: string
}

export function useNotifications() {
  const items = useState<CdNotification[]>('cd-notifications', () => [])
  const loading = useState('cd-notifications-loading', () => false)
  const loaded = useState('cd-notifications-loaded', () => false)
  const open = useState('cd-notifications-open', () => false)

  const unread = computed(() => items.value.filter((n: CdNotification) => !n.read_at).length)

  async function load(force = false) {
    if (loading.value || (loaded.value && !force)) return
    loading.value = true
    try {
      const res = await $fetch<{ notifications: CdNotification[] }>('/api/notifications')
      items.value = res.notifications ?? []
      loaded.value = true
    } catch (err) {
      console.error('[notifications] load failed:', err)
    } finally {
      loading.value = false
    }
  }

  /** Mark read locally first — the badge should drop on the tap, not on the
   *  round trip — then tell the server. */
  async function markRead(id: string) {
    const row = items.value.find((n: CdNotification) => n.id === id)
    if (!row || row.read_at) return
    row.read_at = new Date().toISOString()
    items.value = [...items.value]
    try {
      await $fetch('/api/notifications/read', { method: 'POST', body: { id } })
    } catch (err) {
      console.error('[notifications] mark read failed:', err)
    }
  }

  async function markAllRead() {
    if (!unread.value) return
    const now = new Date().toISOString()
    items.value = items.value.map((n: CdNotification) => (n.read_at ? n : { ...n, read_at: now }))
    try {
      await $fetch('/api/notifications/read', { method: 'POST', body: { all: true } })
    } catch (err) {
      console.error('[notifications] mark all read failed:', err)
    }
  }

  function show() {
    open.value = true
    load(true)
  }

  return { items, unread, loading, loaded, open, load, markRead, markAllRead, show, hide: () => (open.value = false) }
}
