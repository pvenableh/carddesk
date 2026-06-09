// server/utils/email-send.ts
/**
 * Thin SendGrid wrapper for CardDesk transactional email.
 *
 * Best-effort by design: never throws. Returns { sent, reason } so callers
 * (signup, password reset) can fire-and-forget without a mail outage breaking
 * the user flow. Mirrors the Earnest app's email-send.ts, minus org branding —
 * CardDesk transactional mail is always CardDesk-branded.
 */

interface SendArgs {
  to: string
  subject: string
  html: string
  text?: string | null
  /** Human-readable email kind, e.g. 'password-reset'. Becomes a SendGrid category + custom arg. */
  emailName: string
}

export interface SendResult {
  sent: boolean
  reason?: string
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const { to, subject, html, text, emailName } = args
  if (!to || !subject || !html) {
    return { sent: false, reason: 'missing to/subject/html' }
  }

  const config = useRuntimeConfig()
  const apiKey = config.sendgridApiKey as string | undefined
  if (!apiKey) {
    console.warn(`[email] SENDGRID_API_KEY not set — skipping "${emailName}" to ${to}`)
    return { sent: false, reason: 'no api key' }
  }

  const fromEmail = (config.sendgridFromEmail as string) || 'hello@earnest.guru'
  const fromName = (config.sendgridFromName as string) || 'CardDesk'
  const replyTo = (config.sendgridReplyToEmail as string) || ''
  const bcc = (config.sendgridBccEmail as string) || ''

  try {
    const sgMail = await import('@sendgrid/mail')
    sgMail.default.setApiKey(apiKey)

    const message: Record<string, any> = {
      to,
      from: { email: fromEmail, name: fromName },
      subject,
      html,
      ...(text ? { text } : {}),
      categories: ['carddesk', emailName].filter(Boolean),
      customArgs: { app: 'carddesk', email_name: emailName },
    }
    if (replyTo) message.replyTo = replyTo
    if (bcc && bcc !== to) message.bcc = bcc

    await sgMail.default.send(message as any)
    return { sent: true }
  } catch (err: any) {
    const reason = err?.response?.body?.errors?.[0]?.message || err?.message || 'send failed'
    console.warn(`[email] failed to send "${emailName}" to ${to}:`, reason)
    return { sent: false, reason }
  }
}
