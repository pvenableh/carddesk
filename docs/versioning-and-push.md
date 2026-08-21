# Versioning & push notifications

How a CardDesk client learns that it is running old code, what it does about it,
and how push fits in.

## The problem

An installed PWA is never "reloaded" the way a browser tab is. iOS and Android
keep the standalone window alive for days, so a client can sit on a build whose
JS chunks no longer exist on the CDN. Two failure modes follow:

- **Stale UI** — the user swears the bug isn't fixed, because for them it isn't.
- **Hard breakage** — a lazy route chunk 404s mid-navigation and the app dies.

A desktop tab left open for a week has the same problem, minus the install.

## The two identifiers

| | What it is | Changes when | Used for |
|---|---|---|---|
| `app.buildId` | Nuxt's random per-build hash | **every** build, including a rebuild of the same commit | the update handshake |
| `public.release` | `{ sha, short, ref, builtAt }` from git / Vercel env | every commit | telling a human which build they're on |

`buildId` is the oracle precisely because it is not the commit: a rebuild of an
unchanged commit still produces different asset hashes, so clients still need to
move. `release` is cosmetic — the account panel, the console line on boot, and
`/api/version`.

## Detection: six independent signals

All of them live in [`app/plugins/app-update.client.ts`](../app/plugins/app-update.client.ts).
No single dead channel can strand a client.

1. **Nuxt's build manifest** — every build writes `_nuxt/builds/latest.json`;
   Nuxt re-checks it around route changes (`checkOutdatedBuildInterval`, set to
   5 minutes) and fires `app:manifest:update`.
2. **The `x-app-build` response header** — [`server/middleware/app-build.ts`](../server/middleware/app-build.ts)
   stamps every `/api/*` response with the running build id; a `window.fetch`
   wrapper compares it on every call. A stale client learns the moment it talks
   to a newer server, even mid-rollout.
3. **A poll of `/api/version`** — gated on visibility: on resume after >60s
   backgrounded, and every 5 minutes while visible. This is the one that catches
   a PWA parked on a single screen that never navigates and never calls an API.
   [`/api/version`](../server/api/version.get.ts) is answered by the running
   function, so it cannot be stale relative to the deploy; `latest.json` is the
   fallback if the API is unreachable but the CDN isn't.
4. **The service worker** — `$pwa.needRefresh` flips when a new worker is
   waiting. This fires for an offline-first client that hasn't talked to the
   server at all.
5. **The service worker, from the other side** — it re-checks `/api/version`
   whenever it wakes for a push and messages open clients (`cd-version`); and
   `controllerchange` tells a page that a new worker took over.
6. **The cross-tab bus** — whichever window notices first tells the rest, over
   `BroadcastChannel` with a `localStorage` fallback. Five tabs and the installed
   app move together instead of drifting apart.

## What happens next

One rule:

- **Page hidden** → apply immediately and silently. Nobody is looking, nothing
  is lost.
- **Page visible** → raise `<AppUpdateToast>` and let the user choose.

The exception is an **update blocker**: `useAppUpdate().registerUpdateBlocker(fn)`
lets a screen veto a *silent* reload while there is work a surprise reload would
destroy (the account card editor registers one for its dirty form). It never
blocks a reload the user asked for. When a blocker holds, `pending` stays true,
so the toast is waiting the moment they return.

A chunk 404 has no such choice: `emitRouteChunkError: 'automatic-immediate'`
reloads straight away, because the app is already broken by the time we'd ask.

## Applying is not just "reload"

CardDesk registers its service worker in `prompt` mode, so a new worker parks
itself in `waiting`. **Reloading under the old worker just re-serves the old
precache, forever.** `useAppUpdate().applyUpdate()` therefore:

1. nudges the registration and tells any waiting worker to `skipWaiting`;
2. waits (max 2.5s) for `controllerchange`;
3. reloads regardless — a client with no service worker must not be stranded
   waiting for an event that will never arrive.

It also broadcasts `applying` on the cross-tab bus first, so every other window
follows the same build. And because the new worker calls `clients.claim()`,
`controllerchange` fires in every controlled page anyway — belt and braces.

The worker purges the previous build's runtime caches (`cd-api`, `cd-images`) on
activate and calls `cleanupOutdatedCaches()`, so an old app shell can never
shadow a fresh deploy on a long-installed device.

## Cache headers

Four URLs must never be cached by an edge or a browser, or a client can never
learn it is stale. They're pinned in `nuxt.config.ts` → `routeRules`:

```
/_nuxt/builds/latest.json
/api/version
/sw.js
/manifest.webmanifest
```

## Push notifications

Subscriptions live in the shared Directus `push_subscriptions` collection
(shared with Earnest; CardDesk rows are filtered by `origin LIKE '%carddesk%'`).

- Client: [`usePushSubscription`](../app/composables/usePushSubscription.ts) —
  capability detection, permission, subscribe/unsubscribe.
- Server: [`server/utils/web-push.ts`](../server/utils/web-push.ts) —
  `cdPushToUser`, `cdPushBroadcast`, `cdPushConfigured`. Dead endpoints
  (404/410) are pruned automatically.
- UI: `<CdPushPrompt>` (first-run nudge on the home screen) and
  `<CdNotificationSettings>` (account → Profile: on/off, test push, version).

**Sends must be awaited.** These run on Vercel functions, which are frozen the
instant the response is returned — a fire-and-forget send is a send that may
never leave the box.

### Triggers

| Trigger | Source | Schedule |
|---|---|---|
| Overdue hot follow-ups | `/api/cron/follow-ups` | daily 14:00 UTC |
| Streak about to break | `/api/cron/streaks` | daily 22:00 UTC |
| Card scanned on another device | `/api/cd/scan-notify` | on scan |
| Test | `/api/push/test` | user-initiated |
| Deploy ping | `/api/push/broadcast` | after a deploy (manual) |

### The deploy ping

`POST /api/push/broadcast` (Bearer `CRON_SECRET`) wakes every installed app's
service worker so it can drop stale caches and notify open windows. Silent by
default — it shows no notification at all.

```bash
APP_URL=https://carddesk.example CRON_SECRET=… pnpm notify:deploy
```

Add `--announce "What's new"` to make it a real, user-visible release note on
every device at once. That's a product decision, not a routine one.

A silent push spends the browser's silent-push budget, so this is deliberately
**not** wired to fire automatically on every commit. Open tabs and foregrounded
apps don't need it — they discover the build on their own within five minutes.

### App-icon badge

The badge can only be *raised* from the service worker, because a push usually
lands with no page open; the count is persisted in Cache Storage (`cd-badge`)
since the worker is killed between pushes. The page corrects it — CardDesk's
pushes are nudges with no unread row behind them, so opening the app clears it
([`useAppBadge`](../app/composables/useAppBadge.ts), mounted in `app.vue`, hooked
to both `visibilitychange` and `pageshow` because an installed PWA is *resumed*,
not reloaded).

## Environment

| Var | Purpose |
|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | web push keypair (shared with Earnest) |
| `VAPID_SUBJECT` | `mailto:` contact on the VAPID JWT |
| `CRON_SECRET` | gates the cron routes and the deploy ping |
| `VERCEL_GIT_COMMIT_SHA` / `_REF` | supplied by Vercel; becomes the release stamp |
| `NUXT_PUBLIC_RELEASE_SHA` | manual override where git isn't available at build time |

## Verifying a change

1. `pnpm build && pnpm preview`, open the app, note the build id logged as
   `[cd] build …`.
2. Rebuild without changing anything. The id changes.
3. The open tab should raise the toast within 5 minutes, or instantly on its
   next API call. A second tab should raise it at the same moment.
4. Background the tab → it reloads itself silently; foreground it and the build
   id in the console is the new one.
5. Account → Profile → Notifications shows the new short sha.
