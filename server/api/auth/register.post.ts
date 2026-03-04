import { createDirectus, rest, registerUser, authentication } from '@directus/sdk'
import { fetchUserProfile } from '../../utils/profile'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, first_name, last_name } = body

  if (!email || !password)
    throw createError({ statusCode: 400, message: 'Email and password are required' })

  const config = useRuntimeConfig()

  try {
    const directus = createDirectus(config.public.directusUrl)
      .with(rest())

    await directus.request(
      registerUser({
        email,
        password,
        first_name: first_name || undefined,
        last_name: last_name || undefined,
      })
    )

    // Auto-login after registration
    const authDirectus = createDirectus(config.public.directusUrl)
      .with(authentication('json'))
      .with(rest())

    const result = await authDirectus.login({ email, password })

    if (!result?.access_token)
      throw createError({ statusCode: 500, message: 'Registration succeeded but login failed' })

    let profile: Record<string, any> = {}
    try {
      profile = await fetchUserProfile(result.access_token)
    } catch (err) {
      console.error("[register] Failed to fetch user profile:", err)
    }

    await setUserSession(event, {
      user: {
        email,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires: result.expires,
        expires_at: Date.now() + (result.expires ?? 900000),
        profile,
      },
      loggedInAt: Date.now(),
    })

    return { ok: true }
  } catch (err: any) {
    if (err.statusCode) throw err

    const status = err?.response?.status ?? 500
    const message =
      status === 400
        ? 'Registration failed. Email may already be in use.'
        : 'Registration failed. Please try again.'

    throw createError({ statusCode: status, message })
  }
})
