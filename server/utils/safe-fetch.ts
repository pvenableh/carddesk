/**
 * SSRF-guarded outbound fetch.
 *
 * `/api/resolve-card-link` follows a URL that a *stranger* chose — it comes off
 * a QR code someone held up at a conference. Without a guard that turns our
 * server into a proxy for the attacker: `http://169.254.169.254/…` (cloud
 * metadata), `http://localhost:8055` (our own Directus), or an internal host on
 * the deploy network. So every hop is validated before the request goes out,
 * redirects are followed by hand (a 302 into a private host is the classic
 * bypass), and the body is capped so a huge/streaming response can't chew the
 * function's memory or time budget.
 *
 * Known limitation: DNS is resolved for the check and again by fetch, so a
 * rebinding attacker with a sub-second TTL could in theory slip through the
 * gap. Closing that means dialing the IP directly with a custom agent, which
 * breaks TLS SNI/cert validation for the common case — not worth it for a
 * read-only fetch whose body we never execute and only ever parse as text.
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export interface SafeFetchResult {
  /** Final URL after redirects. */
  url: string
  status: number
  contentType: string
  /** Response body as text, truncated to MAX_BYTES. */
  body: string
}

const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 4
const TIMEOUT_MS = 8000
const USER_AGENT = 'CardDeskBot/1.0 (+https://carddesk.app; contact card import)'

function ipv4IsPrivate(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = p
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true // 192.0.0.0/24 protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast + reserved
  return false
}

/**
 * Expand an IPv6 address into its 8 groups. Needed because WHATWG URL
 * normalises the address before we see it — `http://[::ffff:10.0.0.1]/` comes
 * back as `::ffff:a00:1`, so pattern-matching the dotted form alone would wave
 * a mapped private address straight through. Returns null if it can't be read,
 * which callers treat as private (fail closed).
 */
function expandIpv6(ip: string): number[] | null {
  let v = ip.split('%')[0].toLowerCase() // strip any zone id
  // Fold a trailing dotted-quad (::ffff:10.0.0.1) into two hex groups.
  const dotted = v.match(/^(.*?:)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (dotted) {
    const o = dotted[2].split('.').map(Number)
    if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
    v = `${dotted[1]}${(((o[0] << 8) | o[1]) >>> 0).toString(16)}:${(((o[2] << 8) | o[3]) >>> 0).toString(16)}`
  }
  const halves = v.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : []
  let groups: string[]
  if (halves.length === 1) {
    if (head.length !== 8) return null
    groups = head
  } else {
    const fill = 8 - head.length - tail.length
    if (fill < 0) return null
    groups = [...head, ...Array(fill).fill('0'), ...tail]
  }
  const out = groups.map((g) => parseInt(g || '0', 16))
  return out.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff) ? null : out
}

function ipv6IsPrivate(ip: string): boolean {
  const g = expandIpv6(ip)
  if (!g) return true
  if (g.every((x) => x === 0)) return true // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true // ::1 loopback

  // Anything carrying an embedded IPv4 address is judged as that address:
  // ::ffff:0:0/96 (mapped), ::/96 (deprecated compat), 64:ff9b::/96 (NAT64).
  const mapped = g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff
  const compat = g.slice(0, 6).every((x) => x === 0)
  const nat64 = g[0] === 0x0064 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)
  if (mapped || compat || nat64) {
    const v4 = [(g[6] >> 8) & 0xff, g[6] & 0xff, (g[7] >> 8) & 0xff, g[7] & 0xff].join('.')
    return ipv4IsPrivate(v4)
  }

  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

function ipIsPrivate(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return ipv4IsPrivate(ip)
  if (kind === 6) return ipv6IsPrivate(ip)
  return true
}

/** Validate scheme/port/host and confirm every resolved address is public. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw createError({ statusCode: 400, message: "That doesn't look like a valid link." })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw createError({ statusCode: 400, message: 'Only http and https links can be opened.' })
  if (url.username || url.password)
    throw createError({ statusCode: 400, message: 'That link looks unsafe to open.' })
  if (url.port && url.port !== '80' && url.port !== '443')
    throw createError({ statusCode: 400, message: 'That link uses a blocked port.' })

  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (/\.(local|internal|localhost)$/i.test(host) || host.toLowerCase() === 'localhost')
    throw createError({ statusCode: 400, message: "That link points somewhere we can't open." })

  if (isIP(host)) {
    if (ipIsPrivate(host)) throw createError({ statusCode: 400, message: "That link points somewhere we can't open." })
    return url
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw createError({ statusCode: 400, message: "We couldn't reach that link." })
  }
  if (!addresses.length || addresses.some((a) => ipIsPrivate(a.address)))
    throw createError({ statusCode: 400, message: "That link points somewhere we can't open." })
  return url
}

/** Read a response body as text, stopping at MAX_BYTES. */
async function readCapped(res: Response): Promise<string> {
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared && declared > MAX_BYTES * 8)
    throw createError({ statusCode: 413, message: 'That page is too large to read.' })

  const reader = res.body?.getReader()
  if (!reader) return (await res.text()).slice(0, MAX_BYTES)

  const chunks: Uint8Array[] = []
  let total = 0
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) { chunks.push(value); total += value.byteLength }
  }
  try { await reader.cancel() } catch { /* already closed */ }

  const buf = new Uint8Array(Math.min(total, MAX_BYTES))
  let offset = 0
  for (const c of chunks) {
    if (offset >= buf.length) break
    const slice = c.subarray(0, buf.length - offset)
    buf.set(slice, offset)
    offset += slice.length
  }
  return new TextDecoder('utf-8').decode(buf)
}

/**
 * GET a stranger-supplied URL with every hop validated. Throws a 4xx H3 error
 * (safe to surface to the user) when the URL is blocked or unreachable.
 */
export async function safeFetch(raw: string, accept = 'text/vcard,text/html;q=0.9,*/*;q=0.5'): Promise<SafeFetchResult> {
  let current = raw
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertSafeUrl(current)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { accept, 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError')
        throw createError({ statusCode: 504, message: 'That card page took too long to respond.' })
      throw createError({ statusCode: 502, message: "We couldn't reach that link." })
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw createError({ statusCode: 502, message: "That link didn't go anywhere." })
      current = new URL(location, url).toString()
      continue
    }
    if (res.status >= 400)
      throw createError({ statusCode: 502, message: `That card page returned an error (${res.status}).` })

    return {
      url: url.toString(),
      status: res.status,
      contentType: (res.headers.get('content-type') || '').toLowerCase(),
      body: await readCapped(res),
    }
  }
  throw createError({ statusCode: 502, message: 'That link redirected too many times.' })
}
