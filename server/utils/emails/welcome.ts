// server/utils/emails/welcome.ts
import { renderCardDeskEmail, escapeHtml, type RenderedEmail } from './shell'

interface WelcomeEmailArgs {
  firstName?: string | null
  /** Where the CTA sends them — confirms the email + drops them into the app. */
  appUrl: string
}

/**
 * 🎨 MJML SWAP POINT — replace the body of this function with your MJML render
 * for the signup welcome / "confirm your email" message. Keep the same args in
 * and { subject, html, text } out. Dynamic content available: firstName, appUrl.
 *
 * Note: with the current signup flow the account is created ACTIVE and the user
 * is logged in immediately, so this is a welcome + soft email-confirmation (not
 * a hard verification gate). If you later want to gate login on confirmation,
 * see the token pattern in /api/auth/password-request.post.ts — the same
 * password_reset_tokens collection / approach works for a verify token.
 */
export function welcomeEmail(args: WelcomeEmailArgs): { subject: string } & RenderedEmail {
  const { firstName, appUrl } = args
  const subject = 'Welcome to CardDesk 🎴'
  const greeting = firstName ? `Hey ${escapeHtml(firstName)},` : 'Hey there,'

  const bodyHtml = `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 16px;">Your CardDesk account is ready. Scan a business card, save the contact, and watch the XP roll in — networking, but make it a game.</p>
    <p style="margin:0 0 16px;">Tap below to confirm this email and jump in:</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#333333;">
      <li style="margin:0 0 6px;">📷 Scan your first card for <strong>+50 XP</strong></li>
      <li style="margin:0 0 6px;">💾 Save the contact for <strong>+25 XP</strong></li>
      <li style="margin:0 0 6px;">🔥 Come back daily to build a streak</li>
    </ul>
  `

  const rendered = renderCardDeskEmail({
    subject,
    preheader: 'Your CardDesk account is ready — confirm your email and start earning XP.',
    heading: 'You’re in.',
    bodyHtml,
    cta: { label: 'Open CardDesk', url: appUrl },
  })

  return { subject, ...rendered }
}
