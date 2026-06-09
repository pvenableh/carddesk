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
 * Gets a valid Directus access token from the session, auto-refreshing if expired or expiring soon.
 * Returns the token and throws a 401 error if not authenticated or refresh fails.
 */
export async function getValidToken(event: H3Event): Promise<string> {
  const session = await getUserSession(event)
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: 'Not authenticated' })

  const expiresAt = session.user.expires_at ?? 0
  const needsRefresh = expiresAt - Date.now() < 60_000 // refresh if <60s left

  if (needsRefresh && session.user.refresh_token) {
    try {
      const config = useRuntimeConfig()
      const res = await $fetch(
        config.public.directusUrl + '/auth/refresh',
        { method: 'POST', body: { refresh_token: session.user.refresh_token, mode: 'json' } },
      ) as any
      const newToken = res.data.access_token
      await setUserSession(event, {
        ...session,
        user: {
          ...session.user,
          access_token: newToken,
          refresh_token: res.data.refresh_token,
          expires: res.data.expires,
          expires_at: Date.now() + res.data.expires,
        },
      })
      return newToken
    } catch (err) {
      console.error('[auth] Token refresh failed:', err)
      await clearUserSession(event)
      throw createError({ statusCode: 401, message: 'Session expired — please log in again' })
    }
  }

  return session.user.access_token
}
