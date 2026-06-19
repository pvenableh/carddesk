import { CLAUDE_MODELS } from './ai-models'

/**
 * Normalise an Anthropic SDK error into a user-facing detail string, and log it
 * with a consistent `[tag] Anthropic error: <status> <detail>` shape. Returns
 * the detail so callers can fold it into their own createError message.
 *
 * Model-not-found (404 …model…) is called out separately: that's a deploy-time
 * misconfiguration — a retired or mistyped model id — not a transient upstream
 * outage, so it's logged loudly and points at the one file the ids live in.
 * This is the failure mode that took down every AI endpoint when Sonnet 4 was
 * retired; making it unmistakable in logs is the whole point.
 */
export function logAnthropicError(tag: string, err: any): string {
  const status = err?.status ?? err?.statusCode
  const detail = err?.error?.error?.message || err?.message || 'unknown error'

  if (status === 404 && /model/i.test(String(detail))) {
    console.error(
      `[${tag}] Anthropic MODEL ERROR (404): ${detail} — the configured model id is invalid or retired. ` +
        `Fix it in server/utils/ai-models.ts (current: default=${CLAUDE_MODELS.default}, vision=${CLAUDE_MODELS.vision}).`,
    )
  } else {
    console.error(`[${tag}] Anthropic error:`, status, detail)
  }
  return detail
}
