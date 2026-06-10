// server/utils/emails/password-reset.ts
import { renderEmail, loadEmailHtml, type RenderedEmail } from './shell'

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
 * Password-reset email. The visual design is in mjml/password-reset.mjml — edit
 * it in the MJML desktop app, export the HTML, and paste it into ./compiled.ts
 * (see ./README.md). Keep the args in and { subject, html, text } out — callers
 * don't change.
 */
export async function passwordResetEmail(args: PasswordResetEmailArgs): Promise<{ subject: string } & RenderedEmail> {
  const expiresIn = args.expiresIn || '1 hour'
  const subject = 'Reset your CardDesk password'
  const passwordResetHtml = await loadEmailHtml('password-reset')
  const rendered = renderEmail(passwordResetHtml, PASSWORD_RESET_TEXT, {
    firstName: args.firstName || null,
    resetUrl: args.resetUrl,
    expiresIn,
    preheader: `Set a new CardDesk password. Link expires in ${expiresIn}.`,
  })

  return { subject, ...rendered }
}
