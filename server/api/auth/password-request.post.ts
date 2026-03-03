import { createDirectus, rest, passwordRequest } from '@directus/sdk'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)

  if (!email)
    throw createError({ statusCode: 400, message: 'Email is required' })

  const config = useRuntimeConfig()

  try {
    const directus = createDirectus(config.public.directusUrl).with(rest())

    await directus.request(
      passwordRequest(email, config.public.appUrl + '/auth/reset-password')
    )

    return { ok: true }
  } catch {
    // Always return success to prevent email enumeration
    return { ok: true }
  }
})
