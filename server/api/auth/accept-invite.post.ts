import { createDirectus, rest, acceptUserInvite } from '@directus/sdk'

export default defineEventHandler(async (event) => {
  const { token, password } = await readBody(event)

  if (!token || !password)
    throw createError({ statusCode: 400, message: 'Token and password are required' })

  const config = useRuntimeConfig()

  try {
    const directus = createDirectus(config.public.directusUrl).with(rest())

    await directus.request(acceptUserInvite(token, password))

    return { ok: true }
  } catch (err: any) {
    const status = err?.response?.status ?? 500
    throw createError({
      statusCode: status === 401 || status === 403 ? 400 : 500,
      message: 'Failed to accept invitation. The link may have expired.',
    })
  }
})
