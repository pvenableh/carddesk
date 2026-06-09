// server/utils/emails/shell.ts
/**
 * CardDesk branded transactional email shell.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * 🎨  MJML SWAP POINT
 * ───────────────────────────────────────────────────────────────────────────
 * This is a hand-rolled, inline-CSS shell good enough to ship today. When the
 * MJML designs are ready, the cleanest swap is to replace `renderCardDeskEmail`
 * with a function that compiles your MJML (mjml2html) and returns { html, text }.
 * Each email module (./password-reset.ts, ./welcome.ts) only depends on this
 * function's signature, so swapping the renderer here updates every email at
 * once. Keep the { subject, preheader, heading, bodyHtml, cta } inputs and the
 * { html, text } output and nothing downstream changes.
 *
 * HTML rules for inbox compatibility (until MJML replaces this):
 *   - Inline CSS only, no <style> blocks, no CSS variables.
 *   - max-width 560px container; system sans-serif; 16px body.
 *   - No flexbox, no media queries, no background images.
 */

const BRAND_NAME = 'CardDesk'
const BRAND_HOME = 'https://earnest.guru'
const BRAND_INK = '#0b1220' // near-black, used for headings + CTA bg
const BRAND_ACCENT = '#0a8f5b' // readable green (neon --cd-accent is too light on white)
const BG = '#f4f6f8'

interface CtaSpec {
  label: string
  url: string
}

export interface CardDeskShellArgs {
  subject: string
  preheader?: string | null
  heading?: string | null
  /** Trusted HTML fragment for the email body (paragraphs etc.). */
  bodyHtml: string
  cta?: CtaSpec | null
}

export interface RenderedEmail {
  html: string
  text: string
}

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`

export function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]!))
}

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = String(url).trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function preheaderBlock(text: string | null | undefined): string {
  if (!text) return ''
  return `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG};opacity:0;">${escapeHtml(text)}</div>`
}

function ctaBlock(cta: CtaSpec | null | undefined): string {
  if (!cta) return ''
  const url = safeUrl(cta.url)
  if (!url) return ''
  return `
    <p style="margin:28px 0 12px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND_INK};color:#ffffff;text-decoration:none;padding:13px 24px;border-radius:9999px;font-size:14px;font-weight:700;letter-spacing:0.02em;font-family:${FONT};">${escapeHtml(cta.label)}</a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#8a94a6;font-family:${FONT};">Or paste this link into your browser:<br /><a href="${escapeHtml(url)}" style="color:#8a94a6;">${escapeHtml(url)}</a></p>
  `
}

export function renderCardDeskEmail(args: CardDeskShellArgs): RenderedEmail {
  const headingMarkup = args.heading && String(args.heading).trim()
    ? `<h1 style="margin:8px 0 16px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${BRAND_INK};letter-spacing:-0.01em;">${escapeHtml(args.heading)}</h1>`
    : ''

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(args.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
${preheaderBlock(args.preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:24px 32px 8px 32px;text-align:left;">
            <a href="${BRAND_HOME}" style="text-decoration:none;color:${BRAND_INK};font-family:${FONT};font-size:20px;font-weight:800;letter-spacing:-0.02em;">${BRAND_NAME}<span style="color:${BRAND_ACCENT};">.</span></a>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 16px 32px;">
            ${headingMarkup}
            <div style="font-family:${FONT};font-size:16px;line-height:1.6;color:#333333;">${args.bodyHtml}</div>
            ${ctaBlock(args.cta)}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#8a94a6;">
              This is an automated message from ${BRAND_NAME} — your gamified networking sidekick.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  const text = htmlToText([args.heading || '', '', args.bodyHtml, args.cta?.url ? `\n${args.cta.label}: ${args.cta.url}` : ''].join('\n'))
  return { html, text }
}
