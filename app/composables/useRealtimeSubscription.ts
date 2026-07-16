// composables/useRealtimeSubscription.ts
// Per-collection realtime subscription over the SHARED WebSocket connection
// (useWebSocketManager). Ported from the Earnest app and adapted to CardDesk:
//
//   - Hydration comes from Directus's own `init` subscription event (CardDesk
//     has no generic /api/directus/items REST proxy like Earnest does), so
//     there's no separate REST pre-load — the WS delivers current rows on
//     subscribe and live create/update/delete after.
//   - An optional `onEvent(event, rows)` hook lets callers that already own
//     their state (useContacts, useFeed, …) react — e.g. refetch an enriched
//     server endpoint — instead of consuming the raw `data` ref.
//
// All subscriptions share a single WebSocket, managed by useWebSocketManager.

interface RealtimeOptions {
  /** Row shape for the WS subscribe query. Defaults to ['*']. */
  fields?: string[]
  /** Directus filter for the subscription. */
  filter?: any
  /** Sort applied to the subscription/init payload. */
  sort?: string | null
  /**
   * Called on every live event (`init` | `create` | `update` | `delete`) with
   * the raw rows. Use this to trigger a refetch of an enriched/scoped endpoint
   * when the collection is only a change *signal* (e.g. the feed).
   */
  onEvent?: (event: 'init' | 'create' | 'update' | 'delete', rows: any[]) => void
  /** Start subscribed as soon as the user is authenticated (default true). */
  immediate?: boolean
}

export function useRealtimeSubscription(collection: string, options: RealtimeOptions = {}) {
  const data = ref<any[]>([])
  const isConnected = ref(false)
  const lastUpdated = ref<Date | null>(null)
  const currentFilter = ref<any>(options.filter ?? {})

  // ─── SSR / no-op guard ─────────────────────────────────────────────────────
  if (import.meta.server) {
    return {
      data,
      isConnected,
      lastUpdated,
      connect: () => {},
      disconnect: () => {},
      updateFilter: () => {},
      currentFilter: readonly(currentFilter),
    }
  }

  const { loggedIn } = useUserSession()
  const manager = useWebSocketManager()

  const fields = options.fields ?? ['*']
  const sort = options.sort === undefined ? '-date_created' : options.sort

  let _sub: { uid: string; unsubscribe: () => void } | null = null

  const buildQuery = () => ({ fields, filter: currentFilter.value, sort })

  // ─── Live event handler ────────────────────────────────────────────────────
  const handleEvent = (event: string, rows: any[]) => {
    switch (event) {
      case 'init':
        data.value = Array.isArray(rows) ? rows : []
        break
      case 'create':
        for (const row of rows) {
          if (!data.value.some((r) => r.id === row.id)) data.value = [...data.value, row]
        }
        break
      case 'update':
        for (const row of rows) {
          data.value = data.value.map((r) => (r.id === row.id ? { ...r, ...row } : r))
        }
        break
      case 'delete':
        // Directus sends deleted primary keys as the payload array.
        data.value = data.value.filter((r) => !rows.includes(r.id) && !rows.some((d: any) => d?.id === r.id))
        break
    }
    lastUpdated.value = new Date()
    try {
      options.onEvent?.(event as any, rows)
    } catch (err) {
      console.error(`[Realtime:${collection}] onEvent handler error:`, err)
    }
  }

  // ─── Connect / disconnect ──────────────────────────────────────────────────
  const connect = () => {
    if (!loggedIn.value || _sub) return
    _sub = manager.subscribe(collection, buildQuery(), handleEvent)
  }

  const disconnect = () => {
    if (_sub) {
      _sub.unsubscribe()
      _sub = null
    }
    isConnected.value = false
  }

  const updateFilter = (newFilter: any) => {
    if (JSON.stringify(currentFilter.value) === JSON.stringify(newFilter)) return
    currentFilter.value = newFilter
    if (_sub) manager.resubscribe(_sub.uid, buildQuery())
    else connect()
  }

  // Mirror the shared connection status.
  watch(manager.isConnected, (v) => (isConnected.value = v), { immediate: true })

  // React to auth changes: drop on logout, (re)connect shortly after login.
  watch(loggedIn, (isIn, wasIn) => {
    if (!isIn) {
      disconnect()
      data.value = []
    } else if (isIn && !wasIn) {
      setTimeout(() => {
        if (loggedIn.value && options.immediate !== false) connect()
      }, 500)
    }
  })

  if (loggedIn.value && options.immediate !== false) connect()

  if (getCurrentScope()) onScopeDispose(disconnect)

  return {
    data,
    isConnected,
    lastUpdated,
    connect,
    disconnect,
    updateFilter,
    currentFilter: readonly(currentFilter),
  }
}
