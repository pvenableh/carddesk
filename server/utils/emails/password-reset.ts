// server/utils/emails/password-reset.ts
import { renderEmail, type RenderedEmail } from './shell'
import { passwordResetHtml } from './compiled'

interface PasswordResetEmailArgs {
  firstName?: string | null
  resetUrl: string
  /** How long the link stays valid, for the copy. Defaults to "1 hour". */
  expiresIn?: string
}

// Plain-text fallback. Mirrors the MJML copy; tokens match the design source.
const PASSWORD_RESET_TEXT = `Hi {{#if firstName}}{{firstName}}{{else}}there{{/if}},

We got a request to reset the password on your CardDesk account. Open the link below to choose a new one.

This link expires in {{expiresIn}} and can only be used once.

Set a new password: {{resetUrl}}

If you didn't request this, you can safely ignore this email — your password stays the same.

This is an automated message from CardDesk — your gamified networking sidekick.`

/**
 * Password-reset email. The visual design is in mjml/password-reset.mjml
 * (compiled into ./compiled.ts via `npm run build:emails`); edit that source and
 * regenerate to change the look. Keep the args in and { subject, html, text }
 * out — callers don't change.
 */
export function passwordResetEmail(args: PasswordResetEmailArgs): { subject: string } & RenderedEmail {
  const expiresIn = args.expiresIn || '1 hour'
  const subject = 'Reset your CardDesk password'
  const rendered = renderEmail(passwordResetHtml, PASSWORD_RESET_TEXT, {
    firstName: args.firstName || null,
    resetUrl: args.resetUrl,
    expiresIn,
    preheader: `Set a new CardDesk password. Link expires in ${expiresIn}.`,
  })

  return { subject, ...rendered }
}
