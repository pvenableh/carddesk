export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user?.refresh_token)
    throw createError({ statusCode: 401, message: 'No refresh token' })
  const config = useRuntimeConfig()
  try {
    const res = await $fetch(
      config.public.directusUrl + '/auth/refresh',
      { method: 'POST', body: { refresh_token: session.user.refresh_token, mode: 'json' } }
    ) as any
    await setUserSession(event, {
      ...session,
      user: { ...session.user, access_token: res.data.access_token,
        refresh_token: res.data.refresh_token, expires: res.data.expires,
        expires_at: Date.now() + res.data.expires },
    })
    return { ok: true }
  } catch {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session expired' })
  }
})
