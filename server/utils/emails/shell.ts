// server/utils/emails/shell.ts
/**
 * Shared render helper for CardDesk transactional emails.
 *
 * The visual design lives in MJML (server/utils/emails/mjml/*.mjml), compiled to
 * HTML strings in ./compiled.ts via `npm run build:emails`. Each email module
 * (./welcome.ts, ./password-reset.ts) pairs its compiled HTML with a plain-text
 * template and the per-send data, then calls `renderEmail` to fill the
 * Handlebars tokens in both. Output stays { html, text } so nothing downstream
 * (sendEmail and its callers) changes.
 *
 * HTML is rendered with Handlebars' default escaping (correct for markup);
 * the text body is rendered with noEscape so URLs and punctuation pass through
 * literally.
 */
import Handlebars from 'handlebars'

export interface RenderedEmail {
  html: string
  text: string
}

// Compiled-template cache keyed by mode + source, so repeated sends don't
// re-parse the same template. Templates are static module constants, so this
// stays tiny and bounded.
const templateCache = new Map<string, Handlebars.TemplateDelegate>()

function compile(source: string, noEscape: boolean): Handlebars.TemplateDelegate {
  const key = (noEscape ? 'T:' : 'H:') + source
  let tmpl = templateCache.get(key)
  if (!tmpl) {
    tmpl = Handlebars.compile(source, { noEscape })
    templateCache.set(key, tmpl)
  }
  return tmpl
}

export function renderEmail(
  htmlTemplate: string,
  textTemplate: string,
  data: Record<string, unknown>,
): RenderedEmail {
  return {
    html: compile(htmlTemplate, false)(data),
    text: compile(textTemplate, true)(data).trim() + '\n',
  }
}
