# CardDesk

Gamified networking CRM built for people who go to networking events and actually want to follow through. Combines practical contact management with game mechanics (XP, levels, streaks, badges) to make relationship building feel rewarding.

**Stack:** Nuxt 4 · Directus 11 · PostgreSQL · Redis · Anthropic Claude Vision · nuxt-auth-utils

---

## Core Philosophy

- Abundance mindset over scarcity — "They are the lucky ones to hear from you"
- Coaching tone, not productivity tool language
- Dark UI inspired by Sleeper app aesthetic
- Every action earns XP — scanning cards, logging follow-ups, maintaining streaks

---

## Project Structure

```
carddesk/
├── nuxt.config.ts
├── .env.example
├── docker-compose.yml
├── package.json
│
├── types/
│   └── directus.ts              # TypeScript interfaces for all Directus collections
│
├── server/
│   ├── utils/
│   │   └── directus.ts          # Directus SDK client helpers (getDirectus, getUserDirectus)
│   └── api/
│       ├── auth/
│       │   ├── login.post.ts    # Directus auth → encrypted session cookie
│       │   ├── logout.post.ts   # Clear session
│       │   └── refresh.post.ts  # Token refresh
│       ├── websocket/
│       │   └── token.get.ts     # WebSocket auth token with auto-refresh
│       ├── scan-card.post.ts    # Claude Vision → structured contact JSON
│       ├── contacts/
│       │   ├── index.get.ts     # List contacts (with activities nested)
│       │   ├── index.post.ts    # Create contact
│       │   └── [id].patch.ts    # Update contact (also used for hibernate/wake)
│       ├── activities/
│       │   ├── index.post.ts    # Log a touchpoint activity
│       │   └── [id].patch.ts    # Mark activity as responded
│       └── xp/
│           ├── index.get.ts     # Load XP state for current user
│           └── index.post.ts    # Upsert XP state
│
└── app/
    ├── app.vue                  # Root — bootstraps XP + contacts on login
    ├── middleware/
    │   └── auth.ts              # Redirects unauthenticated users to /login
    ├── assets/css/
    │   └── tailwind.css         # Tailwind imports + dark mode base styles
    ├── pages/
    │   ├── login.vue            # Auth gate page
    │   └── index.vue            # Main app — all screens in one page component
    └── composables/
        ├── useAuth.ts           # login(), logout(), session state
        ├── useContacts.ts       # fetchContacts(), createContact(), updateContact(),
        │                        # hibernate(), wake(), logActivity(), markResponded(),
        │                        # lastActivity(), daysSince(), followUpStatus()
        ├── useCardScan.ts       # openCamera() → base64 → /api/scan-card → ScannedCard
        └── useXp.ts             # earn(), loadXp(), syncXp(), level/badge/streak logic
```

---

## Directus Collections

All CardDesk collections are prefixed `cd_` to avoid conflicts with existing collections on the shared Directus instance.

### `cd_contacts`
The core contact record created after meeting someone.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_created` | UUID | Auto — links to Directus user |
| `date_created` | Timestamp | Auto |
| `date_updated` | Timestamp | Auto |
| `name` | String | Required. Full name |
| `first_name` | String | |
| `last_name` | String | |
| `title` | String | Job title |
| `company` | String | |
| `email` | String | |
| `phone` | String | |
| `industry` | Dropdown | Technology / Finance / Healthcare / Real Estate / Legal / Marketing / Venture Capital / Other |
| `met_at` | String | Event or place where they met |
| `rating` | Dropdown | `hot` / `warm` / `nurture` / `cold` |
| `hibernated` | Boolean | Default false. Soft-pause instead of delete |
| `hibernated_at` | DateTime | |
| `notes` | Text | |
| `activities` | O2M alias | Reverse relation to cd_activities |

### `cd_activities`
A touchpoint log entry linked to a contact.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_created` | UUID | Auto |
| `date_created` | Timestamp | Auto |
| `contact` | M2O → cd_contacts | Required |
| `type` | Dropdown | `email` / `text` / `call` / `meeting` / `linkedin` / `other` |
| `label` | String | Human-readable label |
| `date` | DateTime | Required. When the touchpoint happened |
| `note` | Text | Optional notes |
| `is_response` | Boolean | Default false. Did they respond? |
| `response_note` | String | Notes on response |

### `cd_xp_state`
One row per user. Stores the entire gamification state.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_created` | UUID | Auto |
| `total_xp` | Integer | Default 0 |
| `level` | Integer | Default 1 (Rookie → Legend) |
| `streak` | Integer | Consecutive days active |
| `last_activity_date` | DateTime | For streak calculation |
| `total_scans` | Integer | Business cards scanned |
| `total_contacts` | Integer | Total contacts added |
| `fast_followups` | Integer | Follow-ups within 24h |
| `hot_responses` | Integer | Responses from hot contacts |
| `intros` | Integer | Intros made |
| `unlocked_badges` | JSON | Array of badge key strings |
| `completed_missions` | JSON | Array of completed mission keys for today |
| `missions_date` | DateTime | Date missions were last reset |

---

## Gamification System

### Levels (Rookie → Legend)
| Level | Title | XP Required |
|---|---|---|
| 1 | Rookie | 0 |
| 2 | Hustler | 200 |
| 3 | Connector | 500 |
| 4 | Player | 1,000 |
| 5 | Rainmaker | 2,000 |
| 6 | Closer | 5,000 |
| 7 | Networker | 10,000 |
| 8 | Dealmaker | 20,000 |
| 9 | Legend | 50,000 |

### XP Awards
| Action | XP |
|---|---|
| Scan a business card | +50 |
| Log a follow-up | +25 |
| Follow up with hot contact | +50 |
| Contact responds | +100 |
| 7-day streak bonus | +200 |
| Unlock a badge | +75 |

### Badges
| Key | Condition |
|---|---|
| `card_shark` | 5+ scans |
| `hot_streak` | 7-day streak |
| `speed_dialer` | 1+ fast follow-ups |
| `networker` | 10+ contacts |
| `dealmaker` | 1+ hot responses |
| `connector` | 3+ intros |
| `legend` | Reach level 9 |

---

## App Screens (all in `app/pages/index.vue`)

The entire app lives in a single page component with internal screen state. Screens:

1. **Vibe Feed** — Landing screen. Hype cards, mood check, overdue follow-up alerts, cold contact warnings. Rotating motivational copy adapts to user stats.
2. **Session** — Coaching moment. User picks "Need a talking to" (tough love) or "Picker upper" (confidence boost). Shows personalized message based on XP/stats.
3. **Cold Contacts** — Contacts rated cold. Hibernate button. Warm-up message generator.
4. **Home / Dashboard** — XP bar, level, streak, daily missions, recent contacts grid, quick-add button.
5. **Contacts List** — Search, filter by rating, sort. Each card shows rating, days since last touchpoint, follow-up status badge.
6. **Contact Detail** — Full contact info, activity timeline, log follow-up button, mark responded, rate/re-rate, hibernate.
7. **Add Contact** — Form with camera scan button. Claude Vision pre-fills fields from business card photo.

---

## Auth Flow

1. User submits email/password on `/login`
2. `useAuth.login()` calls `POST /api/auth/login`
3. Server authenticates with Directus, stores JWT in encrypted session cookie via `nuxt-auth-utils`
4. All subsequent API calls read token from session — never exposed to client
5. `app/middleware/auth.ts` guards all routes except `/login`
6. Token refresh handled automatically in `/api/auth/refresh` and `/api/websocket/token`

---

## Card Scanning Flow

1. User taps 📷 camera button on Add Contact screen
2. `useCardScan.openCamera()` opens device camera input (`capture="environment"` for rear camera on mobile)
3. Image resized to max 1600px, converted to JPEG base64 in browser
4. `POST /api/scan-card` — server-side only, API key never exposed to client
5. Claude Vision (`claude-opus-4-5`) extracts all fields + infers industry
6. Returns structured JSON: `{ first_name, last_name, name, title, company, email, phone, website, linkedin, address, industry }`
7. Form fields pre-populated — user reviews, edits if needed, picks rating, saves
8. +50 XP awarded, confetti fires

---

## Directus Permissions

CardDesk uses a dedicated **"CardDesk User"** role. Every permission for all three `cd_*` collections has a field-level filter:

```
user_created = $CURRENT_USER
```

This ensures users can only read and modify their own contacts, activities, and XP state.

---

## Key Design Decisions

- **No deletion** — contacts are hibernated, not deleted. Reinforces abundance mindset.
- **Single page app pattern** — all screens in `index.vue` with `currentScreen` state. Fast transitions, no route changes after login.
- **Server-side API key** — Anthropic key never touches the client. All AI calls go through `/api/scan-card`.
- **XP syncs to Directus, falls back to localStorage** — if sync fails, state is preserved locally and synced next session.
- **Shared Directus instance** — all `cd_` prefixed collections live alongside existing huestudios collections on `admin.huestudios.company`. No separate Directus instance needed.

---

## Environment Variables

```bash
DIRECTUS_URL=https://admin.huestudios.company
DIRECTUS_WEBSOCKET_URL=wss://admin.huestudios.company/websocket
DIRECTUS_STATIC_TOKEN=          # Admin static token from Directus user settings
ANTHROPIC_API_KEY=               # sk-ant-... for Claude Vision card scanning
NUXT_SESSION_PASSWORD=           # Min 32 chars random string for cookie encryption
NUXT_PUBLIC_DIRECTUS_ROLE_USER=  # UUID of "CardDesk User" role from Directus
APP_URL=http://localhost:3000
```

---

## Common Tasks for Claude Code

### Adding a new field to a contact
1. Add field in Directus UI (Settings → Data Model → cd_contacts)
2. Add to the TypeScript interface in `types/directus.ts`
3. Add to the `fields` array in `server/api/contacts/index.get.ts`
4. Add to the create payload in `server/api/contacts/index.post.ts`
5. Update the form in `app/pages/index.vue` (Add Contact screen)

### Adding a new XP action
1. Find the relevant user action in `app/pages/index.vue`
2. Call `earn(amount, icon, message, extras)` from `useXp()`
3. If it tracks a counter (like `total_scans`), pass it in `extras`: `earn(50, '📷', 'Card scanned!', { total_scans: state.value.total_scans + 1 })`

### Adding a new badge
1. Add the check to `BADGE_CHECKS` in `app/composables/useXp.ts`
2. Add the badge display to the badges section in `app/pages/index.vue`

### Adding a new screen
1. Add a new value to the screen state options in `app/pages/index.vue`
2. Add a `v-if="currentScreen === 'yourscreen'"` section in the template
3. Add navigation trigger (button or tab)

---

## Local Dev

```bash
pnpm install
cp .env.example .env        # fill in values
docker compose up -d        # start Directus (already running on huestudios server)
pnpm dev
```

## Deploy to Vercel

```bash
pnpm build
```

Add all env vars in Vercel dashboard. Add Vercel domain to `CORS_ORIGIN` in Directus docker-compose and restart.