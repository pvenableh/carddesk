/**
 * Pure helpers for reading a stranger's card *page* — the HTML we get back when
 * a QR points at a hosted digital card rather than a .vcf. Split out of
 * server/api/resolve-card-link.post.ts so the parsing rules can be exercised
 * (and corrected) without an event, a session, or a network call.
 */

export const MAX_VCF_CANDIDATES = 2
export const MAX_TEXT_CHARS = 6000


/** Is this one of our own card URLs? Returns the card's user id if so. */
export function cardDeskCardId(url: string, hosts: string[]): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  if (!hosts.includes(host)) return null
  const m = u.pathname.match(/^\/c\/([^/]+)\/?$/)
  return m ? decodeURIComponent(m[1]) : null
}

/** Drop the parts of a page that aren't content — inline scripts and styles.
 *  Both the text extraction and the "save contact" link hunt need this: a card
 *  page's JS bundle is full of href-looking strings that aren't links at all. */
function stripCode(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
}

/** Strip a page down to the visible text Claude should read. */
export function htmlToText(html: string): string {
  return stripCode(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pull the page title + meta description — often the cleanest "Name, Title at
 *  Company" summary a card page has, and it survives client-rendered pages. */
export function metaHints(html: string): string {
  const out: string[] = []
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  if (title) out.push(`Page title: ${htmlToText(title)}`)
  const metaRe = /<meta[^>]+(?:name|property)=["'](description|og:title|og:description|profile:first_name|profile:last_name)["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = metaRe.exec(html))) {
    const content = m[0].match(/content=["']([^"']*)["']/i)?.[1]
    if (content) out.push(`${m[1]}: ${htmlToText(content)}`)
  }
  return out.join('\n')
}

/**
 * A short human label for a page we couldn't get a card out of — `og:site_name`
 * first (it's the brand, not the tagline), then the `<title>` up to its first
 * separator, then the bare hostname. Used only for feedback copy ("Looks like
 * Acme's website, not a digital card"), so it stays short and never throws.
 */
export function pageLabel(html: string, url: string): string | null {
  const og = html.match(/<meta[^>]+(?:property|name)=["']og:site_name["'][^>]*>/i)?.[0]
  const ogValue = og?.match(/content=["']([^"']*)["']/i)?.[1]
  const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  // Page titles are usually "Thing | Brand" — take the first segment that isn't
  // boilerplate, so "Home | Bright Dental" labels the practice, not the page.
  const segments = rawTitle
    ? htmlToText(rawTitle).split(/\s*[|\u2013\u2014\u00b7\u2022]\s*|\s+-\s+/).map((t) => t.trim()).filter(Boolean)
    : []
  const generic = /^(home|homepage|welcome|index|about( us)?|contact( us)?)$/i
  const title = segments.find((t) => !generic.test(t)) || segments[0] || ''
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } })()
  const label = (htmlToText(ogValue || '') || title || host).trim()
  if (!label) return null
  return label.length > 60 ? `${label.slice(0, 57).trimEnd()}\u2026` : label
}

/** Find links on the page that look like a downloadable contact card. */
export function vcfCandidates(html: string, base: string): string[] {
  const out: string[] = []
  const markup = stripCode(html)
  const hrefRe = /href=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = hrefRe.exec(markup)) && out.length < MAX_VCF_CANDIDATES * 3) {
    const href = m[1]
    if (!/\.vcf(\?|#|$)|vcard|\/vcf(\?|#|\/|$)|save[-_]?contact/i.test(href)) continue
    if (/^(javascript|data):/i.test(href)) continue
    try {
      const abs = new URL(href, base).toString()
      if (!out.includes(abs)) out.push(abs)
    } catch { /* malformed href — skip */ }
  }
  return out.slice(0, MAX_VCF_CANDIDATES)
}

