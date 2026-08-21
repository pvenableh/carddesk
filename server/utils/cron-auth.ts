import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Shared-secret gate for machine-invoked routes (Vercel Cron, a deploy hook,
 * a shell script). Constant-time compare, and a HARD refusal when the secret
 * isn't configured — an environment that forgot CRON_SECRET must expose no
 * privileged tooling rather than an open one.
 */
export function requireCronAuth(event: H3Event): void {
  const expected = (useRuntimeConfig(event) as any).cronSecret as string
  if (!expected) {
    throw createError({ statusCode: 503, message: 'CRON_SECRET not configured' })
  }
  const hdrs = getRequestHeaders(event)
  const provided = (hdrs.authorization || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
}
