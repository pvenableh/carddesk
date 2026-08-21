/**
 * POST /api/push/broadcast — the deploy ping.
 *
 * Wakes the service worker on every installed CardDesk, including apps that
 * have been closed for a week. The worker doesn't show anything: it purges the
 * previous build's runtime caches and tells any open window that a new build is
 * live (public/sw.ts → broadcastVersion). That is the last hole in the update
 * story closed — an install that is never opened while online can still be
 * ready with fresh bytes the next time it is.
 *
 * Silent by default. A push that shows no notification spends the browser's
 * "silent push" budget, which is why this is deliberately NOT wired to run on
 * its own: call it once per meaningful deploy, not per commit. Pass
 * `{ "announce": { "title": "...", "body": "..." } }` to make it a real,
 * user-visible release note instead — a product decision, not a routine one.
 *
 * Machine-authenticated with CRON_SECRET (Authorization: Bearer <secret>), the
 * same gate the cron routes use, because the caller is a deploy hook or a
 * script — never a browser.
 *
 * Usage:
 *   curl -X POST https://<host>/api/push/broadcast \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
import { cdPushBroadcast, cdPushConfigured } from '../../utils/web-push'
import { requireCronAuth } from '../../utils/cron-auth'

interface BroadcastBody {
  announce?: { title?: string; body?: string; url?: string }
}

export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  if (!cdPushConfigured()) {
    throw createError({ statusCode: 503, message: 'Push notifications are not configured on this server' })
  }

  const body = (await readBody<BroadcastBody>(event).catch(() => null)) || {}
  const announce = body.announce
  const config = useRuntimeConfig(event)

  const result = await cdPushBroadcast(
    announce
      ? {
          type: 'app-update',
          // An announced update is a normal visible notification that also
          // happens to refresh the caches.
          silent: false,
          title: announce.title || 'CardDesk was updated',
          body: announce.body || 'Open the app to pick up the latest version.',
          url: announce.url || '/',
          tag: 'cd-app-update',
          data: { kind: 'app_update' },
        }
      : {
          type: 'app-update',
          silent: true,
          // Required by the payload contract; never rendered while silent.
          title: 'CardDesk',
          data: { kind: 'app_update' },
        },
  )

  return {
    ok: true,
    silent: !announce,
    buildId: config.app?.buildId || '',
    ...result,
  }
})
