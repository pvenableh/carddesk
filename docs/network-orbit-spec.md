# CardDesk Orbit — Network & Connections Spec

> Status: living doc. **Phase 1 backend + sharing primitives are built and verified** (see
> [§9 Build status](#9-build-status)). The rest is the design to build against.

Turn CardDesk from a private CRM into a *social* networking game: users connect with each
other, see their network as a living orbit, compete on XP, share a timeline of activity (with
fine-grained privacy), react to each other, and pass contacts/invites around with one tap on
iPhone.

Inspiration: the `insider` proof-of-concept's `/connections` orbit visual + points competition.
Insider's orbit was hand-coded CSS for a fixed 6 nodes with no backend; we rebuild it as a
**dynamic** visual on a real data model, reusing CardDesk's existing XP/level/badge engine.

---

## 1. Principles

- **Build on what exists.** CardDesk already has `useXp` (XP, levels, streaks, badges),
  `cd_contacts`/`cd_activities`, Directus realtime (websocket), and Web Push. The network feature
  is mostly assembly + one new social layer, not greenfield.
- **Server is the gatekeeper.** New `cd_*` collections are written/read server-side with the
  admin static token + explicit ownership checks (the pattern `cd_credit_accounts` already uses),
  so we don't have to hand-craft per-role Directus permissions.
- **Privacy is opt-in per event.** Nothing about a user is shared to their network unless they
  chose to share it. Default = private.
- **One-tap mobile.** Every share path uses the Web Share API (`navigator.share`) with graceful
  desktop fallbacks.

---

## 2. Data model

### 2.1 `cd_connections` — built ✅

User↔user edges. `requester`/`addressee` are `directus_users` (FK, CASCADE on delete).

| field | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `requester` | m2o → directus_users | who initiated |
| `addressee` | m2o → directus_users | who received |
| `status` | string | `pending` \| `accepted` \| `declined` \| `blocked` |
| `date_created` / `date_updated` | timestamp | auto |

Accepted edge in either direction = "in each other's orbit." A row is unique per unordered pair
(enforced in the POST endpoint, not the DB).

### 2.2 `cd_invites` — to build

Carry the inviter's identity in a share link so a new signup auto-connects (see [§6](#6-invite-links)).

| field | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `inviter` | m2o → directus_users | |
| `code` | string (indexed) | short, URL-safe (e.g. 8 chars) |
| `accepted_by` | m2o → directus_users (nullable) | set when redeemed |
| `accepted_at` | timestamp (nullable) | |
| `expires_at` | timestamp (nullable) | optional TTL; null = evergreen personal link |

A user has one evergreen personal invite code (their "share my CardDesk" link). Redeeming it
creates an `accepted` `cd_connections` row both ways.

### 2.3 `cd_feed_events` — to build

The shareable activity timeline. Distinct from the private `cd_activities` (per-contact CRM log) —
this is the *social* feed a user opts into broadcasting to connections.

| field | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `actor` | m2o → directus_users | whose event |
| `type` | string | `card_scanned` \| `streak_hit` \| `level_up` \| `badge_unlocked` \| `joined` \| `made_intro` \| `note` |
| `visibility` | string | `private` \| `connections` \| `public` (default `private`) |
| `payload` | json | type-specific (e.g. `{ level: 5 }`, `{ badge: 'card_shark' }`) — never raw contact PII |
| `date_created` | timestamp | auto |

Events are emitted by the same code paths that already call `useXp().earn(...)`. A small
`emitFeedEvent(type, payload)` helper writes a row at the user's **default visibility** (a profile
setting), which they can change per-event or globally.

### 2.4 `cd_reactions` — to build (or reuse existing `reactions`)

The shared Directus already has a generic `reactions` collection. Either reuse it (scoped by a
`carddesk`-prefixed target convention) or add a focused one:

| field | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `user` | m2o → directus_users | reactor |
| `event` | m2o → cd_feed_events | target |
| `emoji` | string | 👏 🔥 🤝 🎉 💡 (small fixed set) |

Unique per (user, event, emoji).

### 2.5 Leaderboard — no new collection

Computed on read from the existing `cd_xp_state` across a user's accepted connections. No stored
ranking; it's a query + sort.

---

## 3. API surface

Built (✅) and to-build, all under `/server/api`, all using `getCurrentUserId(event)` for ownership.

| endpoint | status | purpose |
|---|---|---|
| `GET /api/connections` | ✅ | list accepted + pending (with direction) + enriched other-user profile |
| `POST /api/connections` `{userId}` | ✅ | request; auto-accepts on mutual intent; dedups |
| `PATCH /api/connections/[id]` `{action}` | ✅ | `accept`\|`decline`\|`block`\|`remove` |
| `GET /api/invite` | ▢ | get/create my personal invite code + URL |
| `POST /api/invite/redeem` `{code}` | ▢ | redeem (called post-signup) → creates accepted connection |
| `GET /api/network/leaderboard` | ▢ | me + connections, sorted by XP this week / all-time |
| `GET /api/feed` | ▢ | events from me + accepted connections, respecting visibility, paginated |
| `POST /api/feed/[id]/react` `{emoji}` | ▢ | toggle a reaction |
| `PATCH /api/profile` (extend) | ▢ | add `feed_default_visibility`, `discoverable` flags |

---

## 4. The Orbit visual

Replaces insider's fixed CSS-nth-child approach with a **dynamic SVG** that handles any number of
connections.

- **Center:** the user's avatar (their level ring around it, reusing `useXp` level color).
- **Rings:** concentric orbits by relationship tier — inner = most-engaged connections (recent
  reactions/activity), outer = quieter ones. Or by status (accepted solid, pending faint/dashed).
- **Nodes:** each connection is an avatar bubble placed on its ring at
  `angle = (i / count) * 2π`, radius = ring. Sized by their level or shared-activity count.
- **Lines:** a thin SVG line from center to each node; color by the connection's top industry (carry
  over insider's industry-color idea).
- **Motion:** the whole `<g>` rotates slowly via a CSS `@keyframes spin` on a wrapper (respect
  `prefers-reduced-motion`). Use the smooth-rotation pattern already added as `.cd-spin`.
- **Interaction:** tap a node → bottom-sheet mini-profile: name/title, level, mutual stats, recent
  shared events, **[Share contact]** (vCard) and **[React]**. Pending nodes show **Accept/Decline**.
- **Implementation:** a `<NetworkOrbit>` component taking `connections[]`; compute node positions in
  a `computed`; render `<svg viewBox="-200 -200 400 400">`. No external lib needed. Canvas only if
  node counts get large (>~150).

**Navigation (decided):** the bottom bar is a deliberate 2 + center-Scan-FAB + 2 layout, so we do
**not** add a 6th button. Instead the existing **Network** tab becomes two sub-tabs — **Contacts**
(the current rolodex / `ContactsScreen`) and **Connections** (the orbit). All "people" live under
one roof (à la LinkedIn "My Network"), symmetry is preserved, and the orbit is one tap from a
top-level slot. Stats and Vibe stay as-is. Implementation: a segmented control at the top of the
Network screen toggling the two views; the orbit is a `<NetworkOrbit>` component, not a separate
`Screen` route.

---

## 5. Leaderboard / competition

- Reuse `cd_xp_state.total_xp` plus a derived "XP this week" (we already track activity dates).
- `GET /api/network/leaderboard` returns `[{ user, xp, level, rank, isMe }]` for me + accepted
  connections, sorted desc; supports `?window=week|all`.
- Surface as a strip on the orbit screen ("#3 of 12 this week") and a full list view.
- Ties into existing badges (`networker`, `connector`) and could add network-specific badges
  (e.g. `orbit_builder` at 10 accepted connections).

---

## 6. Invite links

The "easy to share the URL" ask, done right so it actually grows the graph:

1. `GET /api/invite` returns `{ code, url }` where `url = ${appUrl}/i/${code}`.
2. User shares it via `useShare().shareUrl({ url, title: 'Join me on CardDesk', text })` → iPhone
   share sheet.
3. `/i/[code].vue` landing page: shows "<Name> invited you to CardDesk", stores `code` (cookie),
   routes to register/login.
4. After signup/login, the app calls `POST /api/invite/redeem {code}` → creates an **accepted**
   `cd_connections` both ways and emits a `joined` feed event. New user lands already connected to
   their inviter. Award XP to both (`+intro`/`connector` badge fuel).

---

## 7. iPhone sharing — built ✅ (primitives)

`app/composables/useShare.ts`:

- `shareContact(contact)` → builds a **vCard 3.0** (`buildVCard`) and shares it as a `.vcf` file via
  the share sheet → iPhone offers **"Add to Contacts"**. Falls back to `.vcf` download on desktop.
  Already wired into `DetailScreen.vue`'s Share button.
- `shareUrl({url,title,text})` → shares a link (invite/profile); falls back to clipboard copy.
- `supported` computed for conditional UI.

To add: a "share my profile/invite" entry point on the orbit screen (uses `shareUrl` + [§6](#6-invite-links)).

---

## 8. XP / rewards integration

Hook network actions into the existing `useXp().earn()`:

| action | XP | existing badge fuel |
|---|---|---|
| send/accept a connection | +15 | `networker` |
| your invite link converts a signup | +75 | `connector` |
| share a contact (vCard) | +5 | — |
| react to a connection's event | +2 (daily cap) | — |
| make an intro between two connections | +50 | `connector` |

---

## 9. Build status

**Done & verified this iteration**

- `cd_connections` collection + FK relations (Directus).
- `GET/POST /api/connections`, `PATCH /api/connections/[id]` — full lifecycle tested
  (request → list → dedup → accept rules → remove).
- `useShare` composable (vCard + URL share) wired into the contact detail Share button.
- Types in `types/directus.ts` (`CdConnection`, `ConnectionStatus`).

**Done — step 1 + discovery (this iteration)**

- Network screen sub-tabs: `Contacts | Connections` (`ContactsScreen.vue` + `ConnectionsView.vue`).
- Connections list: incoming (accept/decline), accepted (remove), outgoing (cancel) + empty state.
- `cd_invites` collection + `GET /api/invite` (evergreen code) + `POST /api/invite/redeem`.
- Invite UI: share-sheet link (`useShare.shareUrl`) + scannable **QR** (qrcode lib).
- Invite landing `/i/[code].vue` → redeems if signed in, else stashes a cookie and redeems on
  first authenticated load (`pages/index.vue`).
- Opt-in directory: `discoverable` flag on directus_users (managed via admin-token
  `/api/network/discoverable` GET/POST — the user role lacks field perms), `GET /api/users/search`
  (only discoverable, excludes self + existing edges), search box + toggle in `ConnectionsView`.
- **Orbit visual** (`NetworkOrbit.vue`): dynamic SVG, you at centre (level ring), accepted
  connections on auto-sized rings, colour-keyed nodes + connecting lines, slow rotation
  (reduced-motion aware) with upright labels via counter-rotation, tap a node → detail sheet
  (name/title + remove). Swapped into `ConnectionsView` in place of the accepted list.

- **Editable business card** (`cd_cards`): per-user card (name/title/company/email/phone/website/
  linkedin/headline/image + broadcast_activity). Editor at `/card/edit`, image upload to Directus
  files, `GET/PATCH /api/cards/me` + public `/api/cards/[id]`. Public `/c/[id]` renders image +
  links; vCard QR carries website/linkedin/phone. Reachable via the ShareSheet "My Card" tab.
- **Activity feed** (`cd_feed_events` + `cd_reactions`): `emitFeedEvent` hooked into scans,
  level-ups, streaks, badges (client) and connect/redeem (server). `GET /api/feed` (own +
  connections' non-private), `POST /api/feed/[id]/react` (toggle), per-user `broadcast_activity`
  privacy. **Feed** sub-tab under Network with emoji reactions + a share-activity toggle.

- **Leaderboard** (`GET /api/network/leaderboard`): ranks the user + accepted connections by
  total XP (from cd_xp_state, default 0/level 1), with medals for the top 3, level + XP, and a
  "you're #X of N" summary. Rendered under the orbit in the Connections sub-tab.

- **XP hooks**: +15 on accepting a connection, +25 on joining via invite (client); server-side
  `awardServerXp` credits the *inviter* (+75) on convert and the *requester* (+15) on accept since
  they're often offline (picked up on next loadXp).
- **Intros**: `POST /api/connections/intro {a,b}` (both must be your accepted connections) creates
  a pending edge between them, emits an `intro` feed event, and the introducer earns +50 / +1
  intro (feeds the `connector` badge). UI: "Introduce to" picker in the orbit node sheet.
- **Weekly leaderboard**: `week_xp`/`week_start` on cd_xp_state (maintained in `useXp.earn`,
  Mon-based reset); leaderboard `?window=week|all` with an "All-time / This week" UI toggle.
- **Avatars**: `getAvatarUrls` (card image → profile avatar) feeds `/api/connections` +
  `/api/network/leaderboard`; rendered as circular images on orbit nodes (SVG clip) + leaderboard
  rows, falling back to initials.
- **Scoring cheat sheet**: a `ScoreGuide` slide-in flyout (XP table, levels, badges) opened from a
  "?" on the Vibe XP card, via `useScoreGuide`, mounted in the shell.

**Next (recommended order)**

1. **Apple Wallet pass** — "Add to Apple Wallet" on the card. Deferred: needs an Apple Developer
   Pass Type ID cert + WWDR cert + signing key before it can be built/tested.
2. **Weekly leaderboard precision** — `week_xp` only counts XP earned *after* this shipped; older
   activity isn't backfilled (acceptable, but note it).

---

## 10. Open questions

- Discovery: how do users *find* each other to connect (search by name/email, QR at events,
  invite-only)? Recommend invite-only + QR first; add search behind a `discoverable` opt-in.
- Reuse the shared `reactions` collection vs. a dedicated `cd_reactions`?

_Resolved: Nav — the Orbit lives as a "Connections" sub-tab under the existing "Network" tab,
alongside a "Contacts" sub-tab. No new bottom-nav button. (See §4.)_
