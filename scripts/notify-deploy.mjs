#!/usr/bin/env node
/**
 * Deploy ping — tell every installed CardDesk that a new build is live.
 *
 * Run it AFTER a deploy is serving (a Vercel "Deployment Succeeded" webhook, the
 * last step of a release script, or by hand). It wakes each device's service
 * worker so it can drop the previous build's caches and tell any open window to
 * update — which is what closes the gap for an app that is installed but closed.
 *
 * Open tabs and foregrounded apps do NOT need this: they discover the new build
 * on their own within ~5 minutes, or instantly on their next API call.
 *
 * Usage:
 *   APP_URL=https://carddesk.example CRON_SECRET=… node scripts/notify-deploy.mjs
 *   … --announce "Pipeline got faster" --body "Tap to see what changed"
 *
 * With --announce the ping becomes a REAL notification on every device at once.
 * Without it, nothing is shown; it is a silent housekeeping wake-up.
 */

const url = (process.env.APP_URL || process.env.NUXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
const secret = process.env.CRON_SECRET || ''

if (!url || !secret) {
  console.error('Set APP_URL and CRON_SECRET. e.g.\n  APP_URL=https://carddesk.example CRON_SECRET=… node scripts/notify-deploy.mjs')
  process.exit(1)
}

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1] || null
}

const title = flag('announce')
const body = { }
if (title) body.announce = { title, body: flag('body') || undefined, url: flag('url') || undefined }

const res = await fetch(`${url}/api/push/broadcast`, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const text = await res.text()
if (!res.ok) {
  console.error(`[notify-deploy] ${res.status} ${text}`)
  process.exit(1)
}
console.log(`[notify-deploy] ${text}`)
