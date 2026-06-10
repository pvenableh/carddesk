// server/utils/emails/shell.ts
/**
 * Render helper for CardDesk transactional emails.
 *
 * The visual design lives in MJML (server/utils/emails/mjml/*.mjml), compiled to
 * HTML with the MJML *desktop app* and saved as static assets in
 * server/assets/emails/*.html (see ./README.md). That HTML is read at RUNTIME via
 * useStorage('assets:emails') — never bundled — because MJML's HTML breaks the
 * Nitro server bundle's esbuild transform. We also avoid the `mjml` and
 * `handlebars` npm packages for the same reason; token-filling is done by the
 * tiny built-in renderer below.
 *
 * Supported template syntax (a Handlebars subset, enough for these emails):
 *   {{var}}                                  → value (HTML-escaped in html mode)
 *   {{#if var}}...{{else}}...{{/if}}          → conditional block
 *
 * HTML is rendered with escaping (correct for markup); the text body is rendered
 * raw so URLs and punctuation pass through literally. Output stays { html, text }
 * so nothing downstream (sendEmail and its callers) changes.
 */
export interface RenderedEmail {
  html: string
  text: string
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESC[c] ?? c)
}

/** Fill {{#if}} blocks then {{var}} tokens. `escape` HTML-escapes values. */
function fill(template: string, data: Record<string, unknown>, escape: boolean): string {
  const out = template.replace(
    /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_m, key: string, ifBlock: string, elseBlock = '') => (data[key] ? ifBlock : elseBlock),
  )
  return out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const v = data[key]
    const s = v == null ? '' : String(v)
    return escape ? escapeHtml(s) : s
  })
}

/** Read a compiled email's HTML from server assets (server/assets/emails/<name>.html). */
export async function loadEmailHtml(name: string): Promise<string> {
  const html = await useStorage('assets:emails').getItem<string>(`${name}.html`)
  if (typeof html !== 'string') {
    throw new Error(`Email asset not found: server/assets/emails/${name}.html`)
  }
  return html
}

export function renderEmail(
  htmlTemplate: string,
  textTemplate: string,
  data: Record<string, unknown>,
): RenderedEmail {
  return {
    html: fill(htmlTemplate, data, true),
    text: fill(textTemplate, data, false).trim() + '\n',
  }
}
