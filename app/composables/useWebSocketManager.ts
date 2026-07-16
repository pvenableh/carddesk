// composables/useWebSocketManager.ts
// Shared WebSocket connection manager for Directus realtime subscriptions.
// Ported from the Earnest app: multiplexes ALL subscriptions over a single
// WebSocket connection (N→1). Instead of each useRealtimeSubscription opening
// its own socket, this manager maintains one connection and routes messages by
// UID, deduplicating identical collection+query subscriptions.

interface SubscriptionQuery {
  fields: string[]
  filter: any
  sort: string | null
}

interface SubscriptionEntry {
  collection: string
  query: SubscriptionQuery
  handler: (event: string, data: any[]) => void
}

// ─── Module-level singleton state (client-side only) ─────────────────────────

let _ws: WebSocket | null = null
let _wsUrl = ''
let _loggedIn: Ref<boolean> | null = null
let _initialized = false
let _authenticated = false
let _authenticating = false
let _reconnectAttempts = 0
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null

const _subscriptions = new Map<string, SubscriptionEntry>()
const _connected = ref(false)

const MAX_RECONNECT = 5
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 16000

// ─── Initialization (called once from setup context) ─────────────────────────

function _init() {
  if (_initialized || import.meta.server) return
  _initialized = true

  const config = useRuntimeConfig()
  const { loggedIn } = useUserSession()
  _wsUrl = config.public.websocketUrl as string
  _loggedIn = loggedIn

  // Global logout → tear down the shared connection
  watch(loggedIn, (isLoggedIn) => {
    if (!isLoggedIn) _teardown()
  })
}

// ─── Connection lifecycle ────────────────────────────────────────────────────

function _ensureConnection() {
  if (!_loggedIn?.value) return
  if (_ws && _ws.readyState < 2) return // CONNECTING or OPEN

  try {
    const ws = new WebSocket(_wsUrl)
    _ws = ws

    // Guard handlers against stale WebSocket instances to prevent
    // double-connections when close fires on a replaced socket.
    ws.addEventListener('open', () => {
      if (_ws !== ws) return
      _connected.value = true
      _reconnectAttempts = 0
      _authenticate()
    })

    ws.addEventListener('message', (e) => {
      if (_ws !== ws) return
      _onMessage(e)
    })

    ws.addEventListener('close', (e) => {
      if (_ws !== ws) return
      _connected.value = false
      _authenticated = false
      _authenticating = false
      if (!e.wasClean && _loggedIn?.value && _subscriptions.size > 0) _scheduleReconnect()
    })

    ws.addEventListener('error', () => {
      if (_ws !== ws) return
      _connected.value = false
      if (_loggedIn?.value && _subscriptions.size > 0) _scheduleReconnect()
    })
  } catch (err) {
    console.error('[WS Manager] Connection failed:', err)
  }
}

function _teardown() {
  if (_reconnectTimer) {
    clearTimeout(_reconnectTimer)
    _reconnectTimer = null
  }
  if (_ws) {
    try {
      if (_ws.readyState < 2) _ws.close(1000, 'Teardown')
    } catch {}
    _ws = null
  }
  _connected.value = false
  _authenticated = false
  _authenticating = false
  _reconnectAttempts = 0
  _sharedSubs.clear()
  _subscriptions.clear()
}

function _scheduleReconnect() {
  if (_reconnectTimer) clearTimeout(_reconnectTimer)
  if (_reconnectAttempts >= MAX_RECONNECT) return
  if (!_loggedIn?.value) return

  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, _reconnectAttempts), RECONNECT_MAX_MS)
  _reconnectTimer = setTimeout(() => {
    _reconnectAttempts++
    _ensureConnection()
  }, delay)
}

// ─── Authentication ──────────────────────────────────────────────────────────

async function _authenticate() {
  if (!_ws || _ws.readyState !== WebSocket.OPEN || _authenticating) return
  _authenticating = true

  try {
    const res = await $fetch<{ token: string }>('/api/websocket/token')
    const token = res?.token
    if (!token || !_ws || _ws.readyState !== WebSocket.OPEN) {
      _authenticating = false
      return
    }
    _ws.send(JSON.stringify({ type: 'auth', access_token: token }))
  } catch (err) {
    console.error('[WS Manager] Token fetch failed:', err)
    _authenticating = false
  }
}

// ─── Message routing ─────────────────────────────────────────────────────────

function _onMessage(e: MessageEvent) {
  let msg: any
  try {
    msg = JSON.parse(e.data)
  } catch {
    return
  }

  switch (msg.type) {
    case 'auth':
      _onAuth(msg)
      break
    case 'subscription':
      _onSubscriptionData(msg)
      break
    case 'ping':
      if (_ws?.readyState === WebSocket.OPEN) _ws.send(JSON.stringify({ type: 'pong' }))
      break
    case 'error':
      // A per-subscription failure (e.g. the collection isn't readable by the
      // user's policy) arrives as a top-level error. Degrade quietly — other
      // subscriptions on the shared socket keep working; this one just stays
      // dormant until permissions allow it.
      console.debug('[WS Manager] subscription error:', msg.error ?? msg)
      break
  }
}

function _onAuth(msg: any) {
  _authenticating = false
  if (msg.status === 'ok') {
    _authenticated = true
    // (Re-)subscribe every active subscription on this fresh connection.
    for (const uid of _subscriptions.keys()) _sendSubscribe(uid)
  } else {
    console.error('[WS Manager] Auth failed:', msg.reason)
    if (msg.reason?.includes('invalid') || msg.reason?.includes('expired')) _teardown()
  }
}

function _onSubscriptionData(msg: any) {
  const uid = msg.uid
  if (!uid) return
  // A subscription that failed (bad permission/query) reports status:error
  // instead of an event — ignore it rather than fanning a malformed payload out
  // to handlers.
  if (msg.status === 'error' || !['init', 'create', 'update', 'delete'].includes(msg.event)) {
    if (msg.status === 'error') console.debug(`[WS Manager] subscription ${uid} error:`, msg.error ?? msg)
    return
  }
  const entry = _subscriptions.get(uid)
  if (!entry) return
  entry.handler(msg.event, msg.data || [])
}

// ─── Subscribe helpers ───────────────────────────────────────────────────────

function _sendSubscribe(uid: string) {
  const entry = _subscriptions.get(uid)
  if (!entry || !_ws || _ws.readyState !== WebSocket.OPEN) return
  _ws.send(
    JSON.stringify({ type: 'subscribe', collection: entry.collection, query: entry.query, uid }),
  )
}

function _sendUnsubscribe(uid: string) {
  if (!_ws || _ws.readyState !== WebSocket.OPEN) return
  _ws.send(JSON.stringify({ type: 'unsubscribe', uid }))
}

// ─── Subscription deduplication registry ────────────────────────────────────
// Tracks active subscriptions by `collection:filterHash` so multiple components
// subscribing to the same query share a single WS subscription.

interface SharedSubscription {
  uid: string
  collection: string
  query: SubscriptionQuery
  handlers: Set<(event: string, data: any[]) => void>
}

const _sharedSubs = new Map<string, SharedSubscription>()

function _makeSubKey(collection: string, query: SubscriptionQuery): string {
  return `${collection}:${JSON.stringify(query.filter || {})}:${JSON.stringify(query.fields)}:${query.sort || ''}`
}

// ─── Public composable ──────────────────────────────────────────────────────

export function useWebSocketManager() {
  _init()

  /**
   * Register a subscription on the shared connection. Identical
   * collection+filter+fields subscriptions share one WS subscription — the
   * handler is added to the existing entry instead of opening a duplicate.
   * Returns a uid and an unsubscribe function.
   */
  function subscribe(
    collection: string,
    query: SubscriptionQuery,
    handler: (event: string, data: any[]) => void,
  ): { uid: string; unsubscribe: () => void } {
    const subKey = _makeSubKey(collection, query)
    const existing = _sharedSubs.get(subKey)

    if (existing) {
      existing.handlers.add(handler)
      return {
        uid: existing.uid,
        unsubscribe: () => {
          existing.handlers.delete(handler)
          if (existing.handlers.size === 0) {
            _sharedSubs.delete(subKey)
            _sendUnsubscribe(existing.uid)
            _subscriptions.delete(existing.uid)
            if (_subscriptions.size === 0) _teardown()
          }
        },
      }
    }

    const uid = `${collection}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`
    const handlers = new Set<(event: string, data: any[]) => void>([handler])
    _sharedSubs.set(subKey, { uid, collection, query, handlers })

    // The per-uid entry fans out to all shared handlers.
    _subscriptions.set(uid, {
      collection,
      query,
      handler: (evt, data) => {
        const shared = _sharedSubs.get(subKey)
        if (!shared) return
        for (const h of shared.handlers) {
          try {
            h(evt, data)
          } catch (err) {
            console.error(`[WS Manager] Handler error for ${collection}:`, err)
          }
        }
      },
    })

    _ensureConnection()
    if (_authenticated && _ws?.readyState === WebSocket.OPEN) _sendSubscribe(uid)

    return {
      uid,
      unsubscribe: () => {
        handlers.delete(handler)
        if (handlers.size === 0) {
          _sharedSubs.delete(subKey)
          _sendUnsubscribe(uid)
          _subscriptions.delete(uid)
          if (_subscriptions.size === 0) _teardown()
        }
      },
    }
  }

  /** Resubscribe an existing uid with a new query (e.g. filter change). */
  function resubscribe(uid: string, newQuery: SubscriptionQuery) {
    const entry = _subscriptions.get(uid)
    if (!entry) return
    _sendUnsubscribe(uid)
    entry.query = newQuery
    _ensureConnection()
    if (_authenticated && _ws?.readyState === WebSocket.OPEN) _sendSubscribe(uid)
  }

  /** Force a full reconnect (e.g. after token refresh). */
  function reconnect() {
    _reconnectAttempts = 0
    _teardown()
    if (_subscriptions.size > 0) _ensureConnection()
  }

  return {
    subscribe,
    resubscribe,
    reconnect,
    isConnected: readonly(_connected),
  }
}
