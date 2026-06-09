// server/utils/emails/password-reset.ts
import { renderCardDeskEmail, escapeHtml, type RenderedEmail } from './shell'

interface PasswordResetEmailArgs {
  firstName?: string | null
  resetUrl: string
  /** How long the link stays valid, for the copy. Defaults to "1 hour". */
  expiresIn?: string
}

/**
 * 🎨 MJML SWAP POINT — replace the body of this function with your MJML render
 * for the password-reset email. Keep the same args in and { subject, html, text }
 * out. Dynamic content available: firstName, resetUrl, expiresIn.
 */
export function passwordResetEmail(args: PasswordResetEmailArgs): { subject: string } & RenderedEmail {
  const { firstName, resetUrl } = args
  const expiresIn = args.expiresIn || '1 hour'
  const subject = 'Reset your CardDesk password'
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : 'Hi there,'

  const bodyHtml = `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">We got a request to reset the password on your CardDesk account. Tap the button below to choose a new one.</p>
    <p style="margin:0 0 16px;">This link expires in <strong>${escapeHtml(expiresIn)}</strong> and can only be used once.</p>
    <p style="margin:0 0 16px;color:#8a94a6;font-size:14px;">If you didn't request this, you can safely ignore this email — your password stays the same.</p>
  `

  const rendered = renderCardDeskEmail({
    subject,
    preheader: `Set a new CardDesk password. Link expires in ${expiresIn}.`,
    heading: 'Reset your password',
    bodyHtml,
    cta: { label: 'Set new password', url: resetUrl },
  })

  return { subject, ...rendered }
}
