// server/utils/emails/welcome.ts
import { renderEmail, loadEmailHtml, type RenderedEmail } from './shell'

interface WelcomeEmailArgs {
  firstName?: string | null
  /** Where the CTA sends them — confirms the email + drops them into the app. */
  appUrl: string
}

// Plain-text fallback. Mirrors the MJML copy; Handlebars tokens match the
// design source so both render from the same per-send data.
const WELCOME_TEXT = `Hey {{#if firstName}}{{firstName}}{{else}}there{{/if}},

Your CardDesk account is ready. Scan a business card, save the contact, and watch the XP roll in — networking, but make it a game.

Confirm this email and jump in:
- Scan your first card for +50 XP
- Save the contact for +25 XP
- Come back daily to build a streak

Open CardDesk: {{appUrl}}

This is an automated message from CardDesk — your gamified networking sidekick.`

/**
 * Signup welcome / "confirm your email" message. The visual design is in
 * mjml/welcome.mjml — edit it in the MJML desktop app, export the HTML, and paste
 * it into ./compiled.ts (see ./README.md). Keep the args in and
 * { subject, html, text } out — callers don't change.
 *
 * Note: with the current signup flow the account is created ACTIVE and the user
 * is logged in immediately, so this is a welcome + soft email-confirmation (not
 * a hard verification gate). If you later want to gate login on confirmation,
 * see the token pattern in /api/auth/password-request.post.ts — the same
 * password_reset_tokens collection / approach works for a verify token.
 */
export async function welcomeEmail(args: WelcomeEmailArgs): Promise<{ subject: string } & RenderedEmail> {
  const subject = 'Welcome to CardDesk 🎴'
  const welcomeHtml = await loadEmailHtml('welcome')
  const rendered = renderEmail(welcomeHtml, WELCOME_TEXT, {
    firstName: args.firstName || null,
    appUrl: args.appUrl,
    preheader: 'Your CardDesk account is ready — confirm your email and start earning XP.',
  })

  return { subject, ...rendered }
}
