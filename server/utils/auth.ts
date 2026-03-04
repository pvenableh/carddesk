import type { H3Event } from 'h3'

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
