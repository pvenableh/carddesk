/**
 * Single source of truth for the Claude model IDs used across the AI endpoints.
 *
 * Why this file exists: model IDs were previously hardcoded in every
 * server/api/ai-*.ts handler. When Anthropic retired `claude-sonnet-4-20250514`
 * (June 15, 2026) every endpoint started 404-ing at once and each had to be
 * fixed individually. Centralising the IDs here means the next model bump is a
 * one-line change, and `PRICING` in ai-credits.ts stays in sync by construction.
 *
 * Use bare model aliases (no date suffix) so we always get the latest snapshot
 * of a given model — see https://platform.claude.com/docs/en/about-claude/models/overview
 */
export const CLAUDE_MODELS = {
  /** Default text model — chat, suggestions, extraction, short generations. */
  default: 'claude-sonnet-4-6',
  /** Highest-quality / vision model — business-card scanning. */
  vision: 'claude-opus-4-8',
} as const

export type ClaudeModel = (typeof CLAUDE_MODELS)[keyof typeof CLAUDE_MODELS]
