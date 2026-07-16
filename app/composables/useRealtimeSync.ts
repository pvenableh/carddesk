// composables/useRealtimeSync.ts
// App-level realtime orchestrator. Wires Directus realtime subscriptions (over
// the shared useWebSocketManager connection) to CardDesk's existing state
// composables, so a change on the server — from another device, another tab, or
// another user — reconciles the live UI without a manual refresh.
//
// Strategy: most CardDesk data is enriched/scoped by server API routes (admin
// token + visibility logic), so we subscribe to the raw collection purely as a
// CHANGE SIGNAL and debounce-refetch the authorized endpoint. That keeps all
// enrichment and scoping on the server while giving realtime freshness.
//
// Call once from the app root (pages/index.vue) inside setup.

const OWN = { user_created: { _eq: '$CURRENT_USER' } }

function debounce(fn: () => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null
  return () => {
    if (t) clearTimeout(t)
    t = setTimeout(fn, ms)
  }
}

export function useRealtimeSync() {
  if (import.meta.server) return

  const { fetchContacts } = useContacts()
  const { loadXp } = useXp()
  const { load: loadConnections } = useConnections()
  const { load: loadFeed } = useFeed()
  const { dirty: plansDirty } = usePlans()

  // Silent, debounced reconciles — coalesce bursts (e.g. a multi-row write)
  // into a single refetch and never flash a screen's loading/empty state.
  const refetchContacts = debounce(() => fetchContacts({ silent: true }).catch(() => {}), 400)
  const refetchXp = debounce(() => loadXp().catch(() => {}), 400)
  const refetchConnections = debounce(() => loadConnections(true).catch(() => {}), 400)
  const refetchFeed = debounce(() => loadFeed(true).catch(() => {}), 400)
  // Plans/tasks views (TaskBoard, PlansBoard, ContactPlans) all `watch(dirty)`
  // and refetch — so a realtime change just bumps the shared counter.
  const bumpPlans = debounce(() => plansDirty.value++, 400)

  // ── Contacts (user-token readable; scoped to me) ──────────────────────────
  useRealtimeSubscription('cd_contacts', { fields: ['id'], filter: OWN, onEvent: refetchContacts })

  // ── XP / level / streak (user-token readable; scoped to me) ───────────────
  useRealtimeSubscription('cd_xp_state', { fields: ['id'], filter: OWN, sort: null, onEvent: refetchXp })

  // ── The rest use the shared socket as a change SIGNAL and refetch the
  //    server-scoped endpoint. They stay dormant until the CardDesk User policy
  //    grants read on these collections (see the permission note); the manager
  //    degrades a not-yet-permitted subscription to a silent no-op. ──────────

  // Feed events (connection-graph visibility can't be a Directus permission, so
  // this is signal-only → refetch the authorized /api/feed).
  useRealtimeSubscription('cd_feed_events', { fields: ['id'], filter: {}, onEvent: refetchFeed })
  // Reactions — someone reacting to a visible event refreshes the feed (and the
  // neutral→colour reaction styling) live.
  useRealtimeSubscription('cd_reactions', { fields: ['id'], filter: {}, sort: null, onEvent: refetchFeed })

  // Connection requests / acceptances — appear live in the Network view.
  useRealtimeSubscription('cd_connections', { fields: ['id'], filter: {}, onEvent: refetchConnections })

  // Tasks & plans — boards update live as items are added/completed/reordered.
  useRealtimeSubscription('cd_tasks', { fields: ['id'], filter: {}, onEvent: bumpPlans })
  useRealtimeSubscription('cd_plans', { fields: ['id'], filter: {}, onEvent: bumpPlans })
}
