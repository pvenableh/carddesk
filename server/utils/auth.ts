import type { H3Event } from 'h3'
import { readMe } from '@directus/sdk'
import { getUserDirectus } from './directus'

/**
 * Resolves the signed-in user's Directus UUID. Sessions don't store the
 * id directly (only the access token + a denormalized profile blob), so
 * we hit /users/me on demand. Cheap; Directus caches with the access token.
 *
 * Throws 401 if not authenticated.
 */
export async function getCurrentUserId(event: H3Event): Promise<string> {
  const token = await getValidToken(event)
  try {
    const directus = getUserDirectus(token)
    const me = (await directus.request(readMe({ fields: ['id'] as any }))) as any
    if (!me?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
    return me.id as string
  } catch (err: any) {
    const status = err?.statusCode || err?.status || 401
    throw createError({ statusCode: status, message: 'Not authenticated' })
  }
}

/**
 * Like getCurrentUserId, but also returns a Directus client bound to the user's
 * own access token. Use this client for the writes the user themselves performs
 * (their card, reactions, connections, invites) so Directus attributes the
 * activity to the actual user instead of the shared static token. System-level
 * reads/writes (user lookups, XP grants, feed fan-out) should keep using
 * getDirectus() — the user role can't see those rows.
 */
export async function getUserClient(
  event: H3Event,
): Promise<{ me: string; directus: ReturnType<typeof getUserDirectus> }> {
  const token = await getValidToken(event)
  try {
    const directus = getUserDirectus(token)
    const me = (await directus.request(readMe({ fields: ['id'] as any }))) as any
    if (!me?.id) throw createError({ statusCode: 401, message: 'Not authenticated' })
    return { me: me.id as string, directus }
  } catch (err: any) {
    const status = err?.statusCode || err?.status || 401
    throw createError({ statusCode: status, message: 'Not authenticated' })
  }
}

/**
 * In-process single-flight for token refresh, keyed by the refresh token.
 * Directus rotates refresh tokens in `json` mode (each is single-use), so when
 * the client fires several authenticated requests at once (e.g. the app-boot
 * `Promise.all([...])`) and the token is inside its pre-expiry window, every
 * request would otherwise POST /auth/refresh with the *same* token — the first
 * wins, the rest get 401 and used to clear the session, logging the user out
 * mid-use. Deduping concurrent refreshes on one instance collapses them to a
 * single call whose result everyone shares.
 */
const refreshInFlight = new Map<string, Promise<{ access_token: string; refresh_token: string; expires: number }>>()

async function refreshTokens(refreshToken: string) {
  const config = useRuntimeConfig()
  const res = (await $fetch(config.public.directusUrl + '/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken, mode: 'json' },
  })) as any
  return {
    access_token: res.data.access_token as string,
    refresh_token: res.data.refresh_token as string,
    expires: res.data.expires as number,
  }
}

/**
 * Gets a valid Directus access token from the session, auto-refreshing if expired or expiring soon.
 * Returns the token and throws a 401 error if not authenticated or refresh fails.
 */
export async function getValidToken(event: H3Event): Promise<string> {
  const session = await getUserSession(event)
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: 'Not authenticated' })

  const now = Date.now()
  const expiresAt = session.user.expires_at ?? 0
  const needsRefresh = expiresAt - now < 60_000 // refresh if <60s left

  if (!needsRefresh || !session.user.refresh_token)
    return session.user.access_token

  const refreshToken = session.user.refresh_token
  try {
    // Coalesce concurrent refreshes sharing this refresh token into one call.
    let inflight = refreshInFlight.get(refreshToken)
    if (!inflight) {
      inflight = refreshTokens(refreshToken).finally(() => refreshInFlight.delete(refreshToken))
      refreshInFlight.set(refreshToken, inflight)
    }
    const fresh = await inflight
    await setUserSession(event, {
      ...session,
      user: {
        ...session.user,
        access_token: fresh.access_token,
        refresh_token: fresh.refresh_token,
        expires: fresh.expires,
        expires_at: Date.now() + fresh.expires,
      },
    })
    return fresh.access_token
  } catch (err: any) {
    // The refresh failed. If the current access token hasn't actually expired
    // yet, keep using it — this is the rotation race across instances (the loser
    // 401s but its token is still good for up to 60s) and a transient blip.
    // Nuking the session here was the "logged out regularly" bug.
    if (expiresAt > Date.now()) {
      console.warn('[auth] Token refresh failed but access token still valid; continuing:', err?.message ?? err)
      return session.user.access_token
    }
    // Token is genuinely expired. Only force a logout when Directus explicitly
    // rejects the refresh token; a transient network/5xx should be retryable,
    // not a forced re-login.
    const status = err?.response?.status ?? err?.status ?? err?.statusCode
    if (status === 401 || status === 403) {
      console.error('[auth] Refresh token rejected; clearing session:', err?.message ?? err)
      await clearUserSession(event)
      throw createError({ statusCode: 401, message: 'Session expired — please log in again' })
    }
    console.error('[auth] Token refresh failed transiently; keeping session:', err?.message ?? err)
    throw createError({ statusCode: 503, message: 'Auth service temporarily unavailable — please retry' })
  }
}
