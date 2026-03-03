import { authentication, createDirectus, rest } from "@directus/sdk"

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)
  if (!email || !password)
    throw createError({ statusCode: 400, message: "Email and password required" })
  const config = useRuntimeConfig()
  try {
    const directus = createDirectus(config.public.directusUrl)
      .with(authentication("json")).with(rest())
    const result = await directus.login({ email, password })
    if (!result?.access_token)
      throw createError({ statusCode: 401, message: "Invalid credentials" })
    await setUserSession(event, {
      user: {
        email, access_token: result.access_token,
        refresh_token: result.refresh_token, expires: result.expires,
        expires_at: Date.now() + (result.expires ?? 900000),
      },
      loggedInAt: Date.now(),
    })
    return { ok: true }
  } catch (err) {
    const s = err?.response?.status ?? err?.statusCode ?? 500
    throw createError({
      statusCode: s === 401 || s === 403 ? 401 : 500,
      message: s === 401 || s === 403 ? "Invalid email or password" : "Login failed",
    })
  }
})
