// CardDesk web-push helper. Mirrors Earnest's server/utils/web-push.ts —
// same Directus `push_subscriptions` table, same VAPID keypair (both
// origins share a key so the user only sees one VAPID setup script).
//
// CardDesk uses the admin static token to read + write subscriptions so
// callers (cron-triggered) don't need a user session in scope.

import webpush from 'web-push'
import { createDirectus, createItem, deleteItem, readItems, rest, staticToken, updateItem } from '@directus/sdk'

let configured = false

function ensureConfigured(): boolean {
  if (configured) return true
  const config = useRuntimeConfig()
  const publicKey = config.public?.vapidPublicKey as string | undefined
  const privateKey = (config as any).vapidPrivateKey as string | undefined
  const subject = (config as any).vapidSubject || 'mailto:hello@earnest.guru'
  if (!publicKey || !privateKey) {
    console.warn('[cd web-push] VAPID keys not configured — skipping push delivery')
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

function adminDirectus() {
  const config = useRuntimeConfig()
  return createDirectus<any>(config.public.directusUrl as string)
    .with(staticToken(config.directusStaticToken as string))
    .with(rest())
}

export interface CdPushPayload {
  title: string
  body?: string
  url?: string
  tag?: string
  icon?: string
  badge?: string
  /** Absolute app-icon badge count. Omit and the SW increments its own counter. */
  badgeCount?: number
  /** 'app-update' is the deploy ping — see public/sw.ts. */
  type?: string
  /** Only honoured for the deploy ping: show no notification at all. */
  silent?: boolean
  data?: Record<string, any>
}

export interface CdPushResult {
  /** Subscriptions the push service accepted. */
  sent: number
  /** Accepted-nowhere: transient errors, bad keys, rate limits. */
  failed: number
  /** Dead endpoints (404/410) deleted from Directus during this send. */
  pruned: number
}

interface CdPushSub {
  id: string
  user: string
  origin: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string | null
}

const SUB_FIELDS = ['id', 'user', 'origin', 'endpoint', 'p256dh', 'auth', 'user_agent'] as any

/** Every CardDesk subscription (this origin only — Earnest shares the table). */
async function loadSubs(filter: Record<string, any>): Promise<CdPushSub[]> {
  const directus = adminDirectus()
  try {
    return (await directus.request(
      readItems('push_subscriptions' as any, { filter: filter as any, fields: SUB_FIELDS, limit: -1 } as any),
    )) as any
  } catch (err) {
    console.error('[cd web-push] failed to load subscriptions', err)
    return []
  }
}

/**
 * Deliver one payload to a set of subscriptions, AWAITING every send.
 *
 * The awaiting matters more than it looks: these helpers run on Vercel
 * functions, which are frozen the moment the HTTP response is returned. A
 * fire-and-forget send is therefore a send that may simply never happen — the
 * cron reports "pushed: 42" and nobody's phone buzzes. Callers should await
 * this (and the wrappers below) before responding.
 */
async function deliver(subs: CdPushSub[], payload: CdPushPayload): Promise<CdPushResult> {
  const result: CdPushResult = { sent: 0, failed: 0, pruned: 0 }
  if (!subs.length) return result
  const directus = adminDirectus()
  const body = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24 },
        )
        result.sent++
        try {
          await directus.request(
            updateItem('push_subscriptions' as any, sub.id, {
              last_seen_at: new Date().toISOString(),
            } as any),
          )
        } catch {
          // Non-fatal.
        }
      } catch (err: any) {
        const status = err?.statusCode || err?.status
        // Gone (unsubscribed / expired) — prune so we stop trying forever.
        if (status === 404 || status === 410) {
          result.pruned++
          try {
            await directus.request(deleteItem('push_subscriptions' as any, sub.id))
          } catch (cleanupErr) {
            console.error('[cd web-push] cleanup failed', sub.id, cleanupErr)
          }
          return
        }
        result.failed++
        console.error('[cd web-push] send failed', sub.endpoint, status, err?.body || err?.message || err)
      }
    }),
  )
  return result
}

/**
 * Write the notification to the inbox and return its id.
 *
 * The row is the durable thing here; the push is only delivery. A nudge that
 * arrives while the phone is face-down used to be gone the moment it was
 * dismissed — now the app can still show it, count it, and clear it when read.
 *
 * Never throws: failing to record must not stop a send.
 */
async function recordNotification(recipientId: string, payload: CdPushPayload): Promise<string | null> {
  try {
    const created = await adminDirectus().request(
      createItem('cd_notifications' as any, {
        user: recipientId,
        kind: payload.data?.kind || payload.type || null,
        title: payload.title,
        body: payload.body || null,
        url: payload.url || '/',
        data: payload.data || null,
      } as any),
    )
    return (created as any)?.id ?? null
  } catch (err) {
    console.error('[cd web-push] could not record notification', err)
    return null
  }
}

/**
 * Send a CardDesk push to every CardDesk subscription belonging to a
 * recipient. Filters by `origin LIKE '%carddesk%'` so an Earnest-only
 * subscription doesn't get this notification.
 *
 * `excludeUserAgentSubstring` lets the "scanned on another device" trigger
 * skip the device that performed the scan — pass `navigator.userAgent` from
 * the caller.
 */
export async function cdPushToUser(
  recipientId: string,
  payload: CdPushPayload,
  opts?: { excludeUserAgentSubstring?: string | null; persist?: boolean },
): Promise<CdPushResult> {
  const empty: CdPushResult = { sent: 0, failed: 0, pruned: 0 }
  if (!recipientId) return empty

  // Record FIRST, and regardless of whether anything can be delivered: a user
  // with no subscription (or push switched off entirely) should still find the
  // nudge waiting in the app. Delivery is the optional half, not this.
  const notificationId = opts?.persist === false ? null : await recordNotification(recipientId, payload)
  const outgoing: CdPushPayload = notificationId
    ? { ...payload, data: { ...(payload.data || {}), notificationId } }
    : payload

  if (!ensureConfigured()) return empty

  const subs = await loadSubs({
    _and: [{ user: { _eq: recipientId } }, { origin: { _contains: 'carddesk' } }],
  })
  if (!subs.length) return empty

  const exclude = opts?.excludeUserAgentSubstring || ''
  const targets = exclude ? subs.filter((s) => !s.user_agent || !s.user_agent.includes(exclude)) : subs
  return deliver(targets, outgoing)
}

/**
 * Send one payload to EVERY CardDesk subscription.
 *
 * The only intended caller is the deploy ping (POST /api/push/broadcast), whose
 * job is to wake each installed app's service worker so it can drop the previous
 * build's caches and tell any open window that a new build is live. Treat a
 * user-visible broadcast as a product decision, not a routine tool — it reaches
 * every device at once.
 */
export async function cdPushBroadcast(payload: CdPushPayload): Promise<CdPushResult> {
  if (!ensureConfigured()) return { sent: 0, failed: 0, pruned: 0 }
  const subs = await loadSubs({ origin: { _contains: 'carddesk' } })
  return deliver(subs, payload)
}

/** Is web push actually configured in this environment? */
export function cdPushConfigured(): boolean {
  return ensureConfigured()
}
