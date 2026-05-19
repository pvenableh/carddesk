// CardDesk web-push helper. Mirrors Earnest's server/utils/web-push.ts —
// same Directus `push_subscriptions` table, same VAPID keypair (both
// origins share a key so the user only sees one VAPID setup script).
//
// CardDesk uses the admin static token to read + write subscriptions so
// callers (cron-triggered) don't need a user session in scope.

import webpush from 'web-push'
import { createDirectus, deleteItem, readItems, rest, staticToken, updateItem } from '@directus/sdk'

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
  data?: Record<string, any>
}

interface CdPushSub {
  id: string
  user: string
  origin: string
  endpoint: string
  p256dh: string
  auth: string
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
  opts?: { excludeUserAgentSubstring?: string | null },
): Promise<void> {
  if (!ensureConfigured()) return
  if (!recipientId) return

  const directus = adminDirectus()
  let subs: CdPushSub[] = []
  try {
    subs = (await directus.request(
      readItems('push_subscriptions' as any, {
        filter: {
          _and: [
            { user: { _eq: recipientId } },
            { origin: { _contains: 'carddesk' } },
          ],
        } as any,
        fields: ['id', 'user', 'origin', 'endpoint', 'p256dh', 'auth', 'user_agent'] as any,
        limit: -1,
      } as any),
    )) as any
  } catch (err) {
    console.error('[cd web-push] failed to load subscriptions for', recipientId, err)
    return
  }
  if (!subs.length) return

  const exclude = opts?.excludeUserAgentSubstring || ''
  const targets = exclude
    ? subs.filter((s: any) => !s.user_agent || !s.user_agent.includes(exclude))
    : subs

  const body = JSON.stringify(payload)

  void Promise.allSettled(
    targets.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 24 },
        )
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
        if (status === 404 || status === 410) {
          try {
            await directus.request(deleteItem('push_subscriptions' as any, sub.id))
          } catch (cleanupErr) {
            console.error('[cd web-push] cleanup failed', sub.id, cleanupErr)
          }
          return
        }
        console.error('[cd web-push] send failed', sub.endpoint, status, err?.body || err?.message || err)
      }
    }),
  )
}
