# CardDesk

Gamified networking CRM built for people who go to networking events and actually want to follow through. Combines practical contact management with game mechanics (XP, levels, streaks, badges) and a CRM pipeline to make relationship building feel rewarding.

**Stack:** Nuxt 4 · Directus 11 · PostgreSQL · Redis · Anthropic Claude Vision · nuxt-auth-utils

---

## Core Philosophy

- Abundance mindset over scarcity — "They are the lucky ones to hear from you"
- Coaching tone, not productivity tool language
- Dual theme system: Sleeper (dark neon) and Glass (white-on-white iOS glass)
- Every action earns XP — scanning cards, logging follow-ups, pipeline progression, maintaining streaks
- Integrated with Earnest's CRM pipeline and AI Context Broker

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
│   │   ├── directus.ts          # Directus SDK client helpers (getDirectus, getUserDirectus)
│   │   ├── auth.ts              # Token validation and auto-refresh
│   │   ├── profile.ts           # User profile fetching
│   │   ├── earnest-context.ts   # Earnest Context Broker bridge + Score fetching
│   │   └── contact-lead-match.ts # Match CardDesk contacts to Earnest leads
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
│       │   ├── [id].patch.ts    # Mark activity as responded
│       │   └── [id].delete.ts   # Delete an activity
│       ├── xp/
│       │   ├── index.get.ts     # Load XP state for current user
│       │   └── index.post.ts    # Upsert XP state
│       ├── ai-suggestions.post.ts    # Per-contact next-step suggestions (enriched with Earnest context)
│       ├── ai-lead-suggestions.post.ts # Lead prioritization with pipeline data
│       ├── ai-insights.post.ts       # Network insights with pipeline health
│       ├── ai-sayings.post.ts        # Pipeline-aware coaching cards
│       ├── ai-goal.post.ts           # AI-suggested networking goals
│       └── earnest-score.get.ts      # Fetch Earnest Score for the user's org
│
└── app/
    ├── app.vue                  # Root — bootstraps XP + contacts on login
    ├── middleware/
    │   └── auth.ts              # Redirects unauthenticated users to /login
    ├── assets/css/
    │   ├── tailwind.css         # Tailwind imports + dark mode base styles
    │   ├── carddesk.css         # Theme system (Sleeper + Glass) + component styles
    │   ├── fonts.css            # Custom font declarations (Proxima Nova, Bauer Bodoni, Gaegu)
    │   └── auth.css             # Authentication page styles
    ├── pages/
    │   ├── login.vue            # Auth gate page
    │   ├── index.vue            # Main app — all screens in one page component
    │   └── account.vue          # Profile settings, theme selector, Earnest Score
    ├── components/
    │   ├── CdIcon.vue           # Theme-aware icon (emoji for Sleeper, Lucide for Glass)
    │   └── phone/
    │       ├── BottomNav.vue    # Glass-effect bottom navigation
    │       ├── HeaderBar.vue    # Top bar with theme switcher dropdown
    │       ├── VibeScreen.vue   # Vibe feed with pipeline health card
    │       ├── SessionScreen.vue # Pipeline-aware coaching sessions
    │       ├── HomeScreen.vue   # Dashboard with XP, missions, AI insights
    │       ├── ContactsScreen.vue # Rating + Pipeline view toggle
    │       ├── DetailScreen.vue # Contact detail with stage management
    │       ├── ColdScreen.vue   # Cold contact re-engagement
    │       ├── AddContactScreen.vue # Card scan + manual add
    │       ├── DarkModeToggle.vue # iOS-style toggle switch
    │       └── XpToast.vue      # XP notification toast
    └── composables/
        ├── useAuth.ts           # login(), logout(), session state
        ├── useContacts.ts       # CRUD + activity logging + follow-up tracking
        ├── useCardScan.ts       # Camera → base64 → /api/scan-card → ScannedCard
        ├── useXp.ts             # XP, levels, badges (including pipeline badges), streaks
        ├── usePipeline.ts       # Pipeline stage management, stats, XP rewards
        ├── useTheme.ts          # Sleeper/Glass theme + dark mode toggle
        ├── useProfile.ts        # User profile CRUD
        ├── useNavigation.ts     # Screen routing with slide transitions
        ├── useConstants.ts      # Ratings, activity types, badges, missions
        └── useFormatters.ts     # Date formatting utilities
```

---

## Theme System

CardDesk ships with two themes, selectable from the Account page or header dropdown:

| Theme | Description | Default Mode |
|---|---|---|
| **Sleeper** | Dark neon aesthetic with green accents (#00ff87) | Dark |
| **Glass** | White-on-white iOS glass design with near-black accents | Light |

The Glass theme includes:
- Frosted glass material utilities (`.glass`, `.glass-thin`, `.glass-ultra`)
- Pill-shaped buttons and inputs (`border-radius: 9999px`)
- iOS press feedback (`.ios-press` with spring easing)
- Bauer Bodoni serif for screen titles, Proxima Nova for body text
- Subtle shadows (`0 1px 2px rgba(0,0,0,0.04)`) instead of neon glows
- Hidden scrollbars for cleaner scroll areas

Theme state is stored in `localStorage` (`cd-theme`, `cd-dark-mode`) and applied via `data-theme` and `data-mode` attributes on `<html>`.

---

## CRM Pipeline

Contacts can be tracked through a sales pipeline alongside the existing rating system:

| Stage | XP Award |
|---|---|
| New | — |
| Contacted | +10 |
| Qualified | +15 |
| Proposal Sent | +20 |
| Negotiating | +25 |
| Won | +150 |
| Lost (with reason) | +10 |

Pipeline features:
- **Contacts screen**: Toggle between Rating and Pipeline view (horizontal Kanban lanes)
- **Detail screen**: Pipeline stage badge + "Move to stage" action sheet
- **Lost reason picker**: Budget / Timing / Competitor / No response / Other
- **Vibe screen**: Pipeline health card with stage counts, total value, stalled deal alerts
- **AI coaching**: Session and suggestions endpoints include pipeline stats for context-aware coaching

---

## Earnest Integration

CardDesk connects to Earnest's ecosystem through the shared Directus instance:

### AI Context Enrichment
All AI endpoints (`ai-suggestions`, `ai-lead-suggestions`, `ai-insights`, `ai-sayings`) fetch org-level context from Earnest's Context Broker (`ai_context_snapshots` collection) when available. This lets AI reference the user's broader business context (clients, projects, invoices).

### Contact-Lead Matching
`server/utils/contact-lead-match.ts` matches CardDesk contacts to Earnest leads by email (primary) or company + name (fallback).

### Earnest Score
The Account page displays the org's Earnest Score (fetched from `earnest_scores` collection) with dimension breakdown. CardDesk CRM activities contribute to the CRM dimension of the score.

### Required Directus Permissions (read-only)
- `leads` — pipeline cross-reference
- `ai_context_snapshots` — context enrichment
- `earnest_scores` — score display
- `clients`, `projects`, `invoices` — AI context

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
| `pipeline_stage` | Dropdown | `new` / `contacted` / `qualified` / `proposal_sent` / `negotiating` / `won` / `lost` |
| `earnest_lead_id` | String | Links to Earnest's `leads` collection |
| `estimated_value` | Number | Deal value estimate |
| `lost_reason` | String | Why the deal was lost |
| `hibernated` | Boolean | Default false. Soft-pause instead of delete |
| `hibernated_at` | DateTime | |
| `is_client` | Boolean | |
| `client_at` | DateTime | |
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
| `type` | Dropdown | `email` / `text` / `call` / `meeting` / `linkedin` / `other` / `contact_added` / `card_scanned` / `converted_client` / `stage_change` / `converted_lead` |
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
| `total_clients` | Integer | Converted clients |
| `fast_followups` | Integer | Follow-ups within 24h |
| `hot_responses` | Integer | Responses from hot contacts |
| `intros` | Integer | Intros made |
| `pipeline_contacts` | Integer | Contacts with pipeline stages |
| `qualified_count` | Integer | Leads qualified |
| `proposals_sent` | Integer | Proposals sent |
| `deals_won` | Integer | Deals closed |
| `lost_reasons_logged` | Integer | Lost reasons logged |
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
| Convert to client | +200 |
| Move to Contacted | +10 |
| Move to Qualified | +15 |
| Move to Proposal Sent | +20 |
| Move to Negotiating | +25 |
| Close a deal (Won) | +150 |
| Log a lost reason | +10 |
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
| `closer` | Convert a client |
| `legend` | Reach level 9 |
| `pipeline_builder` | 10+ contacts with a pipeline stage |
| `qualifier` | Qualify 5 leads |
| `proposal_pro` | Send 3 proposals |
| `deal_closer` | Close 3 deals |
| `pipeline_honest` | Log 5 lost reasons |

---

## App Screens (all in `app/pages/index.vue`)

The entire app lives in a single page component with internal screen state. Screens:

1. **Vibe Feed** — Landing screen. Hype cards, mood check, pipeline health snapshot, overdue follow-up alerts, cold contact warnings, AI lead suggestions with pipeline badges.
2. **Session** — Coaching moment. User picks "Need a talking to" (tough love) or "Picker upper" (confidence boost). Pipeline-aware personalized messages.
3. **Cold Contacts** — Contacts rated cold. Hibernate button. Warm-up message generator.
4. **Home / Dashboard** — XP bar, level, streak, daily missions, AI network insights (with pipeline data), recent contacts grid.
5. **Contacts List** — Toggle between Rating view and Pipeline view (horizontal Kanban lanes with stage counts).
6. **Contact Detail** — Full contact info, pipeline stage badge + "Move to stage" action sheet, activity timeline, log follow-up button, mark responded, rate/re-rate, hibernate. Won triggers confetti; lost prompts reason picker.
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

1. User taps camera button on Add Contact screen
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

Additionally, the CardDesk role needs **read** access to Earnest collections:
- `leads`, `ai_context_snapshots`, `earnest_scores`, `clients`, `projects`, `invoices`

---

## Key Design Decisions

- **No deletion** — contacts are hibernated, not deleted. Reinforces abundance mindset.
- **Single page app pattern** — all screens in `index.vue` with `currentScreen` state. Fast transitions, no route changes after login.
- **Server-side API key** — Anthropic key never touches the client. All AI calls go through server API routes.
- **XP syncs to Directus, falls back to localStorage** — if sync fails, state is preserved locally and synced next session.
- **Shared Directus instance** — all `cd_` prefixed collections live alongside Earnest collections on `admin.earnest.guru`. No separate Directus instance needed.
- **Dual theme system** — Sleeper (dark neon) and Glass (white-on-white iOS) selectable per user, persisted in localStorage.
- **Pipeline + Rating coexistence** — both systems work together. Rating is the quick gut-feel metric, pipeline is the structured sales funnel.

---

## Environment Variables

```bash
DIRECTUS_URL=https://admin.earnest.guru
DIRECTUS_WEBSOCKET_URL=wss://admin.earnest.guru/websocket
DIRECTUS_STATIC_TOKEN=          # Admin static token from Directus user settings
ANTHROPIC_API_KEY=               # sk-ant-... for Claude Vision card scanning + AI features
NUXT_SESSION_PASSWORD=           # Min 32 chars random string for cookie encryption
NUXT_PUBLIC_DIRECTUS_ROLE_USER=  # UUID of "CardDesk User" role from Directus
APP_URL=http://localhost:3000
```

---

## Local Dev

```bash
npm install
cp .env.example .env        # fill in values
npm run dev
```

## Deploy to Vercel

```bash
npm run build
```

Add all env vars in Vercel dashboard. Add Vercel domain to `CORS_ORIGIN` in Directus docker-compose and restart.
