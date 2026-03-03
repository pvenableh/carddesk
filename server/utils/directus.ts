import { createDirectus, rest, staticToken } from '@directus/sdk'
import type { DirectusSchema } from '~/types/directus'

export function getDirectus() {
  const config = useRuntimeConfig()
  return createDirectus<DirectusSchema>(config.public.directusUrl)
    .with(staticToken(config.directusStaticToken as string))
    .with(rest())
}

export function getUserDirectus(token: string) {
  const config = useRuntimeConfig()
  return createDirectus<DirectusSchema>(config.public.directusUrl)
    .with(staticToken(token))
    .with(rest())
}
