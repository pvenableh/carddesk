import { getValidToken } from '../../utils/auth'

/**
 * Cheap authed "is my session still alive?" ping, used by the client on app
 * resume (see app/plugins/session-resume.client.ts).
 *
 * Running getValidToken here does the real work: it refreshes the Directus
 * access token if it's near expiry and slides the session window forward
 * (throttled), so a resumed app proactively renews auth instead of waiting for
 * the first data call. It throws 401 only when the session/refresh token is
 * genuinely dead — the client treats that as a logout. No Directus data read,
 * so it's much lighter than /api/cards/me.
 *
 * NOTE: lives under /api/auth/* so the service worker never caches it
 * (public/sw.ts excludes /api/auth and /api/_auth) — the answer must be live.
 */
export default defineEventHandler(async (event) => {
  await getValidToken(event)
  return { ok: true }
})
