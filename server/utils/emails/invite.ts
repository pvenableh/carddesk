// server/utils/emails/invite.ts
import { renderEmail, loadEmailHtml, type RenderedEmail } from './shell'

interface InviteEmailArgs {
  /** Display name of the person sending the invite. */
  inviterName: string
  /** Recipient's first name, if known. */
  firstName?: string | null
  /** Optional personal note from the inviter (shown as a quote). */
  personalNote?: string | null
  /** The personalized invite link (/i/{code}). */
  inviteUrl: string
}

// Plain-text fallback. Mirrors the MJML copy; Handlebars tokens match the design
// source so both render from the same per-send data.
const INVITE_TEXT = `{{#if firstName}}Hey {{firstName}},{{else}}Hey there,{{/if}}

{{inviterName}} uses CardDesk to keep up with the people they meet — and wants to connect with you on it.
{{#if personalNote}}
"{{personalNote}}"
{{/if}}
CardDesk turns networking into something you actually keep up with — scan a card, remember every conversation, never drop a follow-up.

Accept the invite: {{inviteUrl}}

{{inviterName}} invited you through CardDesk — the gamified networking app. If you weren't expecting this, you can ignore it.`

/**
 * Contact-targeted invitation. Sent from POST /api/invite/send when a user
 * invites one of their contacts. The visual design is in mjml/invite.mjml —
 * edit it in the MJML desktop app, export the HTML, and paste it into
 * server/assets/emails/invite.html (see ./README.md). Keep the args in and
 * { subject, html, text } out — callers don't change.
 */
export async function inviteEmail(args: InviteEmailArgs): Promise<{ subject: string } & RenderedEmail> {
  const subject = `${args.inviterName} invited you to CardDesk 🎴`
  const inviteHtml = await loadEmailHtml('invite')
  const rendered = renderEmail(inviteHtml, INVITE_TEXT, {
    inviterName: args.inviterName,
    firstName: args.firstName || null,
    personalNote: args.personalNote || null,
    inviteUrl: args.inviteUrl,
    preheader: `${args.inviterName} wants to connect with you on CardDesk.`,
  })

  return { subject, ...rendered }
}
