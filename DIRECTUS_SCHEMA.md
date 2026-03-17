# CardDesk — App Overview & Directus Schema

## What Is CardDesk?

CardDesk is a gamified networking CRM built on **Nuxt 4 + Directus 11 + PostgreSQL**. Users scan business cards (via Claude Vision), log follow-up activities, and convert contacts into clients — all wrapped in a game-like XP/level/badge system to keep engagement high.

**Shared Directus instance:** `https://admin.huestudios.company`
All CardDesk collections are prefixed `cd_` to avoid conflicts with other apps on the same instance.

---

## Directus Collections

### `cd_contacts`

The core record representing a person the user has met. Each contact belongs to a single user via `user_created` row-level security (`user_created = $CURRENT_USER`).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | UUID (PK) | auto | auto-generated | |
| `user_created` | UUID → `directus_users` | auto | `$CURRENT_USER` | Owner — enforces row-level access |
| `date_created` | Timestamp | auto | now | |
| `date_updated` | Timestamp | auto | now | |
| `name` | String | **yes** | — | Full display name |
| `first_name` | String | no | — | |
| `last_name` | String | no | — | |
| `title` | String | no | — | Job title |
| `company` | String | no | — | Company / org name |
| `email` | String | no | — | |
| `phone` | String | no | — | |
| `industry` | Dropdown | no | — | `Technology` · `Finance` · `Healthcare` · `Real Estate` · `Legal` · `Marketing` · `Venture Capital` · `Other` |
| `met_at` | String | no | — | Where/when they met (event name, etc.) |
| `rating` | Dropdown | no | null | `hot` · `warm` · `nurture` · `cold` · null |
| `hibernated` | Boolean | no | `false` | Soft-pause (no deletion — abundance mindset) |
| `hibernated_at` | DateTime | no | — | When hibernation started |
| `is_client` | **Boolean** | no | `false` | **Conversion flag — `true` = paying client** |
| `client_at` | **DateTime** | no | — | **Date the contact was converted to a client** |
| `notes` | Text | no | — | Free-text notes |
| `activities` | O2M alias | — | — | Reverse relation → `cd_activities.contact` |

---

### `cd_activities`

A touchpoint or event on a contact's timeline. Every interaction (email sent, call made, card scanned, client converted) is an activity.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | UUID (PK) | auto | auto-generated | |
| `user_created` | UUID → `directus_users` | auto | `$CURRENT_USER` | |
| `date_created` | Timestamp | auto | now | |
| `contact` | M2O → `cd_contacts` | **yes** | — | The contact this activity belongs to |
| `type` | Dropdown | **yes** | — | See activity types below |
| `label` | String | no | — | Human-readable summary (e.g. "Email sent", "Converted to Client") |
| `date` | DateTime | **yes** | — | When the touchpoint occurred |
| `note` | Text | no | — | Optional details |
| `is_response` | Boolean | no | `false` | Did the contact respond to this outreach? |
| `response_note` | String | no | — | Details about the response |

**Activity Types:**

| Type Value | Trigger | Description |
|---|---|---|
| `contact_added` | Automatic | Logged when a new contact is created |
| `card_scanned` | Automatic | Logged when a business card is scanned via camera |
| `email` | Manual | User sent/received an email |
| `text` | Manual | User sent/received a text message |
| `call` | Manual | User had a phone call |
| `meeting` | Manual | User had a meeting |
| `linkedin` | Manual | LinkedIn interaction |
| `other` | Manual | Any other touchpoint |
| `converted_client` | Manual | **Contact was marked as a client — milestone event** |

---

### `cd_xp_state`

One row per user. Stores the entire gamification state (XP, level, streak, badge progress, daily missions).

| Field | Type | Default | Notes |
|---|---|---|---|
| `id` | UUID (PK) | auto-generated | |
| `user_created` | UUID → `directus_users` | `$CURRENT_USER` | |
| `total_xp` | Integer | `0` | Cumulative XP earned |
| `level` | Integer | `1` | Current level (1–9) |
| `streak` | Integer | `0` | Consecutive days with activity |
| `last_activity_date` | DateTime | — | Used for streak calculation |
| `total_scans` | Integer | `0` | Business cards scanned |
| `total_contacts` | Integer | `0` | Total contacts added |
| `total_clients` | Integer | `0` | **Total contacts converted to clients** |
| `fast_followups` | Integer | `0` | Follow-ups within 24h of meeting |
| `hot_responses` | Integer | `0` | Responses from hot-rated contacts |
| `intros` | Integer | `0` | Introductions made |
| `unlocked_badges` | JSON (string[]) | `[]` | Badge keys the user has earned |
| `completed_missions` | JSON (string[]) | `[]` | Mission keys completed today |
| `missions_date` | DateTime | — | Date missions were last reset |

---

## Entity-Relationship Diagram

```
directus_users
     │
     │ user_created (row-level security)
     │
     ├──── cd_contacts ──────────── cd_activities
     │       1 ◄──────── M            (M2O: activity.contact → contacts.id)
     │       │
     │       ├── name, company, title, email, phone
     │       ├── rating: hot | warm | nurture | cold
     │       ├── is_client: boolean  ◄── conversion flag
     │       └── client_at: datetime ◄── conversion date
     │
     └──── cd_xp_state (one row per user)
             ├── total_xp, level, streak
             ├── total_clients  ◄── counter
             └── unlocked_badges (JSON array)
```

---

## Contact-to-Client Flow

This is the core conversion pipeline — taking a new contact from first meeting to paying client.

### Step 1: Contact Creation

A contact enters the system in one of two ways:

- **Card scan** — User photographs a business card → Claude Vision extracts fields → contact created + `card_scanned` activity logged (+50 XP)
- **Manual entry** — User fills out the add-contact form → contact created + `contact_added` activity logged (+50 XP)

New contacts start with no rating (or a user-assigned rating of `hot`, `warm`, `nurture`, or `cold`).

### Step 2: Nurture Phase

Users log activities against contacts to build the relationship:

| Activity | XP (non-hot) | XP (hot lead) |
|---|---|---|
| Email, text, call, meeting, LinkedIn, other | +25 | +50 |
| Contact responds (`is_response = true`) | +100 | +100 |

The rating system helps users prioritize:
- **Hot** — High-value, needs fast follow-up (highlighted, appears in priority lists)
- **Warm** — Active relationship, regular contact
- **Nurture** — Long-term play, check in periodically
- **Cold** — Gone quiet — cold outreach suggestions are AI-generated

### Step 3: Client Conversion

When the user marks a contact as a client:

1. `cd_contacts` update: `is_client = true`, `client_at = <today>`
2. `cd_activities` insert: `type = "converted_client"`, `label = "Converted to Client"`
3. XP award: **+200 XP**
4. `cd_xp_state` update: `total_clients` incremented by 1
5. Badge check: if `total_clients >= 1`, unlock the `closer` badge (+75 XP)

### Step 4: Post-Conversion

Clients remain in the contacts list with a distinct visual badge. Users can continue logging activities. The contact's full timeline (from first scan through conversion and beyond) is preserved.

### Data Flow Summary

```
[Business Card Scan]  OR  [Manual Entry]
          │
          ▼
    cd_contacts created
    cd_activities: type = "contact_added" | "card_scanned"
    cd_xp_state: total_contacts++, total_scans++ (if scanned)
          │
          ▼
    ┌─────────────────────────┐
    │   NURTURE PHASE         │
    │   Log: email, text,     │
    │   call, meeting, etc.   │◄──── cd_activities logged per touchpoint
    │   Track responses       │      cd_xp_state: XP earned per action
    └─────────┬───────────────┘
              │
              ▼
    ┌─────────────────────────┐
    │   CONVERT TO CLIENT     │
    │   is_client = true      │──── cd_contacts updated
    │   client_at = now       │     cd_activities: type = "converted_client"
    │   +200 XP               │     cd_xp_state: total_clients++
    │   "closer" badge check  │
    └─────────────────────────┘
```

---

## Gamification System

### Levels

| Level | Title | XP Threshold |
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
| Follow-up (non-hot contact) | +25 |
| Follow-up (hot contact) | +50 |
| Contact responds | +100 |
| **Convert to client** | **+200** |
| 7-day streak bonus | +200 |
| Unlock a badge | +75 |

### Badges

| Key | Condition | Icon |
|---|---|---|
| `card_shark` | 5+ card scans | 🃏 |
| `hot_streak` | 7-day streak | 🔥 |
| `speed_dialer` | 1+ fast follow-up (within 24h) | ⚡ |
| `networker` | 10+ contacts | 🌐 |
| `dealmaker` | 1+ hot responses | 💎 |
| `connector` | 3+ intros | 🌉 |
| **`closer`** | **1+ clients converted** | **💰** |
| `legend` | Reach level 9 | 👑 |

---

## API Endpoints

All endpoints are server-side Nuxt routes that proxy to Directus using an authenticated user token.

### Contacts
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/contacts` | List all contacts (with nested activities) for current user |
| `POST` | `/api/contacts` | Create a new contact |
| `PATCH` | `/api/contacts/:id` | Update a contact (includes marking as client) |

### Activities
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/activities` | Log a new activity on a contact |
| `PATCH` | `/api/activities/:id` | Update an activity (e.g. mark response) |
| `DELETE` | `/api/activities/:id` | Delete an activity |

### XP State
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/xp` | Load current user's XP state |
| `POST` | `/api/xp` | Upsert XP state (sync from client) |

### AI Features
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/scan-card` | Claude Vision — extract business card data from image |
| `POST` | `/api/ai-insights` | Network analysis and recommendations |
| `POST` | `/api/ai-lead-suggestions` | Per-contact conversion suggestions |
| `POST` | `/api/ai-goal` | Personalized networking goal suggestions |

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Email/password → Directus JWT + encrypted session cookie |
| `POST` | `/api/auth/logout` | Clear session |
| `POST` | `/api/auth/refresh` | Auto-refresh JWT if expiring within 60s |

### Profile
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/profile` | Fetch user profile (includes organization via M2M) |
| `POST` | `/api/profile` | Update user profile fields |

---

## TypeScript Interfaces

These are the exact types used in the app (from `types/directus.ts`):

```typescript
interface CdContact {
  id: string
  user_created: string
  date_created: string
  date_updated: string
  name: string
  first_name?: string
  last_name?: string
  title?: string
  company?: string
  email?: string
  phone?: string
  industry?: string
  met_at?: string
  rating: 'hot' | 'warm' | 'nurture' | 'cold' | null
  hibernated: boolean
  hibernated_at?: string
  is_client: boolean
  client_at?: string
  notes?: string
  activities?: CdActivity[]
}

interface CdActivity {
  id: string
  user_created: string
  date_created: string
  contact: string | CdContact
  type: 'email' | 'text' | 'call' | 'meeting' | 'linkedin'
       | 'other' | 'contact_added' | 'card_scanned' | 'converted_client'
  label: string
  date: string
  note?: string
  is_response: boolean
  response_note?: string
}

interface CdXpState {
  id?: string
  user_created?: string
  total_xp: number
  level: number
  streak: number
  last_activity_date: string
  total_scans: number
  total_contacts: number
  total_clients: number
  fast_followups: number
  hot_responses: number
  intros: number
  unlocked_badges: string[]
  completed_missions: string[]
  missions_date: string
}

interface CdUserProfile {
  first_name?: string
  last_name?: string
  title?: string
  industry?: string
  networking_goal?: string
  location?: string
  organization?: {
    id?: number
    name?: string
    industry?: string
    logo?: string
    address?: string
  } | null
}
```

---

## Key Design Decisions

1. **No deletion** — Contacts are hibernated (`hibernated = true`), never deleted. Reinforces the abundance mindset that every connection has value.
2. **Row-level security** — All `cd_*` collections use `user_created = $CURRENT_USER` permissions. Users only see their own data.
3. **Shared Directus instance** — The `cd_` prefix isolates CardDesk collections from other apps on `admin.huestudios.company`.
4. **Client is a flag, not a separate collection** — `is_client` is a boolean on `cd_contacts`, keeping the data model flat and the timeline unified. A client is just a contact that converted.
5. **XP state syncs to Directus with localStorage fallback** — If the sync fails, state is preserved locally and pushed on next session.
6. **AI keys are server-side only** — Anthropic API key never reaches the client. All Claude calls route through `/api/*` server endpoints.

---

## Improving the Contact-to-Client Flow

To improve the conversion pipeline in the management app, consider:

- **The rating field** (`hot`/`warm`/`nurture`/`cold`) is the primary lead-scoring mechanism. Query `cd_contacts` by rating to build pipeline views.
- **Activity frequency** drives engagement scoring. Count `cd_activities` per contact over recent time windows to identify active vs. stale leads.
- **The `is_response` flag** on activities indicates two-way engagement — contacts with responses are warmer leads.
- **`converted_client` activities** mark the exact conversion moment with a timestamp, enabling funnel analysis (time-to-convert, activities-before-conversion, etc.).
- **`total_clients` in `cd_xp_state`** gives a quick per-user conversion count without querying contacts.
