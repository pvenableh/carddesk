#!/usr/bin/env node
/**
 * Post-deploy health check for the CardDesk embed surfaces.
 *
 * Asserts the embed loader + page are reachable and framable (so the card can
 * be embedded on third-party sites), and — optionally — that Earnest's booking
 * page allows being framed cross-origin by CardDesk's card embed.
 *
 * Uses only Node built-ins (global fetch, Node 18+). No install required.
 *
 * Usage:  node scripts/health-embed.mjs   (or: pnpm health:embed)
 * Env:
 *   HEALTH_BASE      CardDesk base URL        (default https://carddesk.earnest.guru)
 *   HEALTH_CARD_ID   real card/user id        (optional → also probes /embed/<id>)
 *   HEALTH_BOOK_URL  full Earnest booking URL (optional → checks /book framing)
 */

const BASE = (process.env.HEALTH_BASE || 'https://carddesk.earnest.guru').replace(/\/$/, '')
const CARD_ID = process.env.HEALTH_CARD_ID || ''
const BOOK_URL = process.env.HEALTH_BOOK_URL || ''

let failures = 0
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const bad = (m) => { console.error(`  \x1b[31m✗\x1b[0m ${m}`); failures++ }

/** Framable unless X-Frame-Options denies, or CSP frame-ancestors excludes '*'. */
function framable(res) {
  const xfo = res.headers.get('x-frame-options')
  if (xfo && /deny|sameorigin/i.test(xfo)) return false
  const csp = res.headers.get('content-security-policy') || ''
  const m = csp.match(/frame-ancestors([^;]*)/i)
  if (m && !m[1].includes('*')) return false
  return true
}

const get = (url) => fetch(url, { redirect: 'manual', headers: { 'user-agent': 'carddesk-health-check' } })

console.log(`\nCardDesk embed health check → ${BASE}\n`)

// 1. The loader script.
try {
  const res = await get(`${BASE}/embed.js`)
  res.status === 200 ? ok('embed.js → 200') : bad(`embed.js → ${res.status}`)
  const ct = res.headers.get('content-type') || ''
  /javascript|ecmascript/i.test(ct) ? ok(`embed.js content-type (${ct.split(';')[0]})`) : bad(`embed.js content-type "${ct}"`)
  framable(res) ? ok('embed.js framable') : bad('embed.js blocks framing (X-Frame-Options / restrictive CSP)')
} catch (e) {
  bad(`embed.js unreachable: ${e.message}`)
}

// 2. The test harness.
try {
  const res = await get(`${BASE}/embed-test.html`)
  res.status === 200 ? ok('embed-test.html → 200') : bad(`embed-test.html → ${res.status}`)
} catch (e) {
  bad(`embed-test.html unreachable: ${e.message}`)
}

// 3. The embed page (needs a real card id).
if (CARD_ID) {
  try {
    const res = await get(`${BASE}/embed/${encodeURIComponent(CARD_ID)}`)
    res.status === 200 ? ok(`/embed/${CARD_ID} → 200`) : bad(`/embed/${CARD_ID} → ${res.status}`)
    framable(res) ? ok('/embed/:id framable') : bad('/embed/:id blocks framing')
  } catch (e) {
    bad(`/embed/:id unreachable: ${e.message}`)
  }
} else {
  console.log('  • set HEALTH_CARD_ID to also probe /embed/<id>')
}

// 4. Earnest booking framing (the cross-origin nested iframe).
if (BOOK_URL) {
  try {
    const res = await get(BOOK_URL)
    framable(res) ? ok('Earnest /book framable by CardDesk') : bad('Earnest /book blocks framing (X-Frame-Options?)')
  } catch (e) {
    bad(`Earnest /book unreachable: ${e.message}`)
  }
} else {
  console.log('  • set HEALTH_BOOK_URL to also check Earnest /book framing')
}

console.log('')
if (failures) {
  console.error(`\x1b[31m✗ ${failures} check(s) failed\x1b[0m`)
  process.exit(1)
}
console.log('\x1b[32m✓ all embed health checks passed\x1b[0m')
