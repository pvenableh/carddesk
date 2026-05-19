export default defineEventHandler(() => {
  const config = useRuntimeConfig()
  const key = config.public?.vapidPublicKey as string | undefined
  if (!key) {
    throw createError({ statusCode: 503, message: 'Push notifications not configured' })
  }
  return { key }
})
