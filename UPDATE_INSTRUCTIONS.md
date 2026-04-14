# CardDesk Companion App — Update Instructions

These instructions integrate CardDesk with Earnest's latest CRM pipeline updates and AI context system, and align the visual language with Earnest's white-on-white iOS glass design system.

---

## 0. Design System — Earnest Glass Theme Reference

CardDesk currently uses a "Sleeper Dark" aesthetic with neon greens, 135-degree gradient cards, and dark backgrounds (#060810). The target is to align with Earnest's **Glass theme** — a white-on-white, iOS-native, translucent design language. This section is the definitive reference for every new component and screen added below.

### Color Palette

CardDesk should adopt a dual-theme system. The **Glass Light** mode becomes the default. The existing Sleeper Dark can remain as an optional "Dark" toggle.

**Glass Light (default):**
```css
--background:        0 0% 99%;      /* #fcfcfc — barely-warm white */
--foreground:        0 0% 9%;       /* #171717 — near-black text */
--card:              0 0% 100%;     /* #ffffff — pure white surfaces */
--muted:             0 0% 96%;      /* #f5f5f5 — whisper grey fills */
--muted-foreground:  0 0% 40%;      /* #666666 — secondary text */
--border:            0 0% 92%;      /* #ebebeb — ultra-subtle dividers */
--primary:           0 0% 12%;      /* #1f1f1f — near-black for actions */
--primary-foreground: 0 0% 98%;     /* white text on primary */
--ring:              0 0% 12%;      /* focus ring matches primary */
--radius:            0.75rem;       /* 12px base — generous iOS rounding */
```

**Glass Dark:**
```css
--background:        0 0% 5%;       /* #0d0d0d */
--foreground:        0 0% 93%;      /* #ededed */
--card:              0 0% 8%;       /* #141414 */
--muted:             0 0% 14%;      /* #242424 */
--muted-foreground:  0 0% 55%;      /* #8c8c8c */
--border:            0 0% 15%;      /* #262626 */
--primary:           0 0% 93%;      /* inverted — light on dark */
--primary-foreground: 0 0% 5%;
```

**Semantic status colors (both modes):**
```css
--success:     142 72% 46%;    /* green */
--warning:     38  92% 50%;    /* amber */
--destructive: 0   72% 51%;    /* red */
```

**Migration from CardDesk variables:**
| Old (CardDesk)       | New (Glass)                       |
|----------------------|-----------------------------------|
| `--cd-bg: #060810`   | `hsl(var(--background))`          |
| `--cd-bg2: #0d1018`  | `hsl(var(--card))`                |
| `--cd-bdr: #1c2330`  | `hsl(var(--border))`              |
| `--cd-text: #f0f4ff` | `hsl(var(--foreground))`          |
| `--cd-muted: #8898b0`| `hsl(var(--muted-foreground))`    |
| `--cd-accent: #00ff87`| `hsl(var(--primary))`            |
| `bg-blue-600`        | `bg-primary` (near-black pill)    |
| `bg-violet-600`      | `bg-primary/10 text-primary` (subtle AI accent) |

### Glass Material Utilities

Three levels of frosted glass, defined as utility classes:

```css
/* Standard glass — headers, floating bars, overlays */
.glass {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}

/* Thin glass — secondary surfaces, sidebars */
.glass-thin {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: saturate(150%) blur(12px);
  -webkit-backdrop-filter: saturate(150%) blur(12px);
}

/* Ultra glass — modals, sheets, prominent overlays */
.glass-ultra {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: saturate(200%) blur(30px);
  -webkit-backdrop-filter: saturate(200%) blur(30px);
}

/* Dark mode variants */
.dark .glass      { background: rgba(30, 30, 30, 0.72); }
.dark .glass-thin { background: rgba(30, 30, 30, 0.45); }
.dark .glass-ultra { background: rgba(20, 20, 20, 0.85); }
```

**Where to apply:**
- Bottom navigation → `.glass` (replaces the current `blur(24px)` on `cd-bnav`)
- Action sheets / bottom sheets → `.glass-ultra`
- Floating pill headers → `.glass` + `rounded-full`
- Card overlays / expanded states → `.glass-thin`

### Border Radius

The iOS Glass system uses generous, consistent rounding:

| Element | Radius | Tailwind Class |
|---------|--------|----------------|
| Cards, containers | 16px | `rounded-2xl` |
| iOS grouped lists | 12px | `rounded-xl` |
| Buttons (pill) | 9999px | `rounded-full` |
| Inputs, selects | 9999px | `rounded-full` |
| Modals / sheets | 14px top | `rounded-t-[14px]` |
| Tags, badges | 9999px | `rounded-full` |
| Chat bubbles | 24px + asymmetric | `rounded-2xl rounded-br-md` |
| Avatars | 50% | `rounded-full` |

**Key change from CardDesk:** Replace `border-radius: 14-17px` on cards with `rounded-2xl` (16px). Replace `10-12px` on buttons with `rounded-full` (pill). All selects and comboboxes become `rounded-full`.

### Pill-Shaped Buttons

Every interactive button should be pill-shaped. This is the signature Earnest pattern.

**Primary pill:**
```html
<button class="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium uppercase tracking-[0.04em] transition-all duration-200">
  Action
</button>
```

**Ghost/outline pill:**
```html
<button class="px-4 py-2 rounded-full border border-border bg-background text-foreground text-xs font-medium uppercase tracking-[0.04em] hover:bg-muted transition-all duration-200">
  Secondary
</button>
```

**Small utility pill (tags, filters):**
```html
<button class="px-2.5 py-1 rounded-full border border-border text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors">
  Filter
</button>
```

**Pill select (dropdowns):**
```html
<select class="px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium appearance-none">
  <option>Option</option>
</select>
```

**Rating pills (migrated from CardDesk cd-rpill):**
Instead of neon-colored pills, use subtle opacity-based variants:
```html
<!-- Hot -->
<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20">Hot</span>
<!-- Warm -->
<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">Warm</span>
<!-- Nurture -->
<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-success/10 text-success border border-success/20">Nurture</span>
<!-- Cold -->
<span class="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">Cold</span>
```

### iOS Card Pattern

Replace CardDesk's gradient cards with flat white-on-white surfaces:

```css
.ios-card {
  @apply bg-card rounded-2xl border border-border/50 shadow-sm;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.ios-card:hover {
  @apply shadow-md;
}
```

**For grouped settings/lists (iOS Settings style):**
```css
.ios-group {
  @apply bg-card rounded-xl overflow-hidden divide-y divide-border/60;
}
```

**Migration from CardDesk cards:**
| Old (CardDesk) | New (Glass) |
|----------------|-------------|
| `cd-vc` (gradient vibe cards) | `.ios-card` with subtle left-border accent color |
| `cd-scard` (gradient session cards) | `.ios-card` with muted background tint |
| `cd-hero` (gradient hero) | `.ios-card` with slightly elevated shadow |
| `cd-feed` (flat activity feed) | `.ios-card` (already close — just update radius + border) |

### iOS Press Feedback

Replace CardDesk's custom hover/active states with the Earnest spring press:

```css
.ios-press {
  transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease;
}
.ios-press:active {
  transform: scale(0.97);
  opacity: 0.85;
}
```

Apply `.ios-press` to all tappable cards, buttons, and list items.

### Typography

Use Earnest's font stack and hierarchy:

**Font families:**
```css
--font-body:      'Proxima Nova W01 Regular', 'Helvetica Neue', Roboto, Arial, sans-serif;
--font-light:     'Proxima Nova W01 Light';
--font-thin:      'Proxima Nova W01 Thin';
--font-display:   'Bauer Bodoni Pro_1 W05 Roman', 'Times New Roman', serif;
--font-signature: 'Gaegu', cursive;
--font-mono:      'SF Mono', ui-monospace, 'Cascadia Code', monospace;
```

**Migration from CardDesk:**
- Replace Bebas Neue headings with Proxima Nova uppercase tracked (`text-xs font-semibold uppercase tracking-[0.04em]`)
- Use Bauer Bodoni for display/hero text (screen titles like "Your Network", "Pipeline")
- Keep Gaegu for playful accents (taglines, achievement messages)

**Hierarchy (Modern style):**
| Usage | Size | Weight | Transform | Tracking |
|-------|------|--------|-----------|----------|
| Screen titles | 1.75rem | 400 | Sentence case | -0.01em |
| Section headers | 0.625rem | 600 | UPPERCASE | 0.08em |
| Card titles | 0.8125rem | 500 | Normal | 0 |
| Body text | 0.8125rem | 400 | Normal | 0 |
| Labels | 0.625rem | 600 | UPPERCASE | 0.08em |
| Stat numbers | 1.5rem | 600 | Normal | 0 |
| Muted captions | 0.6875rem | 400 | Normal | 0 |

### Shadows

Earnest uses extremely subtle shadows — barely visible, just enough for layering:

```css
/* Default card shadow */
box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

/* Hover/elevated shadow */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);

/* Panel/sheet shadow */
box-shadow: 0 4px 24px rgb(0 0 0 / 0.1), 0 1px 4px rgb(0 0 0 / 0.06);
```

**Key change from CardDesk:** Remove all glow effects (`0 4px 18px rgba(0, 255, 135, 0.4)`, etc.). Replace with the subtle shadows above. The neon glow aesthetic is replaced by clean elevation.

### Animations & Easing

**Spring easing (use everywhere):**
```css
--spring: cubic-bezier(0.16, 1, 0.3, 1);
--spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Page transitions:**
```css
.page-enter-from   { opacity: 0; transform: translateY(8px); }
.page-enter-active { transition: all 0.35s var(--spring); }
.page-leave-active { transition: opacity 0.2s ease; }
.page-leave-to     { opacity: 0; }
```

**List stagger (for contact lists, pipeline cards):**
```css
.stagger-item:nth-child(1) { transition-delay: 0ms; }
.stagger-item:nth-child(2) { transition-delay: 40ms; }
.stagger-item:nth-child(3) { transition-delay: 80ms; }
/* ... up to 320ms for 9+ items */
```

**Replace CardDesk animations:**
| Old (CardDesk) | New (Glass) |
|----------------|-------------|
| `cd-wig` (wiggle rotate) | Remove — use `.ios-press` scale instead |
| `cd-pulse` (opacity pulse) | Keep for loading states, but tone down to 0.7↔1.0 |
| `cd-pf` (flame glow) | Remove — streak shown as text badge, no glow |
| Neon glow box-shadows | Remove entirely |
| `cubic-bezier(0.34, 1.3, 0.64, 1)` pop | Replace with `--spring` |

### Scrollbar & Overflow

```css
/* Hidden scrollbars (Earnest standard) */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* iOS momentum scrolling */
-webkit-overflow-scrolling: touch;
overscroll-behavior: contain;
```

Apply `.scrollbar-hide` to all scroll containers (contact lists, pipeline lanes, activity feeds).

### Status & Pipeline Stage Colors

Use opacity-based coloring on white surfaces (not neon on dark):

| Stage | Light Mode | Dark Mode |
|-------|-----------|-----------|
| New | `bg-muted text-muted-foreground` | Same with dark vars |
| Contacted | `bg-blue-50 text-blue-700 border-blue-200` | `bg-blue-950/30 text-blue-400` |
| Qualified | `bg-amber-50 text-amber-700 border-amber-200` | `bg-amber-950/30 text-amber-400` |
| Proposal Sent | `bg-purple-50 text-purple-700 border-purple-200` | `bg-purple-950/30 text-purple-400` |
| Negotiating | `bg-orange-50 text-orange-700 border-orange-200` | `bg-orange-950/30 text-orange-400` |
| Won | `bg-success/10 text-success border-success/20` | Same |
| Lost | `bg-destructive/10 text-destructive border-destructive/20` | Same |

### Bottom Navigation (BottomNav.vue Migration)

Replace the current CardDesk bottom nav with an Earnest-style glass nav:

```html
<nav class="glass fixed bottom-0 inset-x-0 z-50 border-t border-border/30 pb-safe">
  <div class="flex items-center justify-around py-1">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="flex flex-col items-center gap-0.5 py-2 px-4 text-[10px] font-medium uppercase tracking-[0.06em] transition-colors ios-press"
      :class="active === tab.id ? 'text-foreground' : 'text-muted-foreground'"
    >
      <component :is="tab.icon" class="w-5 h-5" :stroke-width="active === tab.id ? 2 : 1.5" />
      <span>{{ tab.label }}</span>
    </button>
  </div>
</nav>
```

### Safe Area & PWA

Keep all existing safe area handling. Add:
```css
/* iOS status bar integration */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-tap-highlight-color: transparent;
}

body {
  overscroll-behavior-y: none;
}
```

### Earnest Semantic Utility Classes (t-* prefix)

For consistency with the main Earnest app, adopt these semantic classes:

```css
/* Background */
.t-bg          { @apply bg-background; }
.t-bg-alt      { @apply bg-muted/40; }
.t-bg-elevated { @apply bg-card; }

/* Text */
.t-text           { @apply text-foreground; }
.t-text-secondary { @apply text-muted-foreground; }
.t-text-tertiary  { @apply text-muted-foreground/60; }

/* Border */
.t-border         { @apply border-border; }
.t-border-divider { @apply border-border/60; }
```

### Quick Visual Comparison

| Property | CardDesk (Current) | Earnest Glass (Target) |
|----------|-------------------|----------------------|
| Background | `#060810` (pure dark) | `#fcfcfc` (warm white) |
| Cards | 135deg gradients | Flat white + 1px border |
| Buttons | `11px radius`, neon green | `rounded-full` pill, near-black |
| Text | Off-white on dark | Near-black on white |
| Accents | Neon green/orange/purple | Opacity-based subtle tints |
| Shadows | Glow effects | `0 1px 2px rgba(0,0,0,0.04)` |
| Glass | Bottom nav only | Headers, navs, overlays, sheets |
| Inputs | `10px radius` | `rounded-full` pill |
| Labels | Bebas Neue, varied | Proxima Nova, uppercase, tracked |
| Animations | Wiggle, neon pulse | Spring scale, fade, stagger |
| Scrollbars | Default | Hidden |

---

## 1. Sync with Earnest's CRM Pipeline

CardDesk currently manages its own contact rating system (hot/warm/nurture/cold) independently from Earnest's leads pipeline (new → contacted → qualified → proposal_sent → negotiating → won/lost). These should be connected.

### A. Add pipeline stage to contacts

**File: `types/directus.ts`**

Add pipeline stage fields to `cd_contacts`:

```ts
interface CdContact {
  // ... existing fields
  pipeline_stage?: 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiating' | 'won' | 'lost'
  earnest_lead_id?: string  // links to Earnest's `leads` collection
  estimated_value?: number
  lost_reason?: string
}
```

**Directus setup required:** Add these fields to the `cd_contacts` collection in Directus.

### B. Add pipeline view to Contacts screen

**File: `app/components/phone/ContactsScreen.vue`**

Add a toggle between the existing rating filter and a new pipeline view:

- Add a segmented control: `Rating | Pipeline`
- In pipeline mode, group contacts by `pipeline_stage` in a horizontal scrollable lane view (simplified Kanban for mobile)
- Each lane header shows stage name + count
- Contacts are draggable between lanes (or use a "Move to..." action sheet)

### C. Add stage management to Detail screen

**File: `app/components/phone/DetailScreen.vue`**

Add a pipeline stage indicator and actions:

- Show current pipeline stage as a colored badge near the contact name
- Add "Move to stage..." dropdown or bottom sheet
- When moving to "won": trigger a conversion celebration (confetti + XP award)
- When moving to "lost": show a reason picker (budget, timing, competitor, no response, other)
- Log stage changes as activities (new activity type: `stage_change`)

### D. New activity type

**File: `types/directus.ts`**

Add `'stage_change'` and `'converted_lead'` to the activity type union:

```ts
type ActivityType = 'email' | 'text' | 'call' | 'meeting' | 'linkedin' | 'contact_added' | 'card_scanned' | 'converted_client' | 'stage_change' | 'converted_lead'
```

### E. Pipeline XP rewards

**File: `app/composables/useXp.ts`**

Add XP awards for pipeline progression:

| Action | XP |
|--------|-----|
| Move contact to "contacted" | +10 |
| Move contact to "qualified" | +15 |
| Move contact to "proposal_sent" | +20 |
| Move contact to "negotiating" | +25 |
| Close a deal (won) | +150 |
| Log a lost reason | +10 |

### F. New composable: `usePipeline.ts`

**File: `app/composables/usePipeline.ts`**

Create a composable for pipeline operations:

```ts
export function usePipeline() {
  // Move contact to a new pipeline stage
  async function moveToStage(contactId: string, stage: string, metadata?: { lost_reason?: string }) {}

  // Get pipeline stats (counts per stage, total estimated value)
  async function getPipelineStats() {}

  // Get contacts grouped by pipeline stage
  async function getContactsByStage() {}

  return { moveToStage, getPipelineStats, getContactsByStage }
}
```

---

## 2. Integrate Earnest's AI Context

CardDesk's AI endpoints currently build context from local `cd_*` data only. Earnest's Context Broker provides a much richer org-level snapshot. CardDesk should optionally pull from it.

### A. New server utility: Earnest context bridge

**File: `server/utils/earnest-context.ts`**

Create a utility that fetches context from Earnest's Context Broker when available:

```ts
export async function getEarnestContext(orgId: string): Promise<string | null> {
  // Check if Earnest context is available for this org
  // Query Directus for `ai_context_snapshots` where organization = orgId
  // If found and fresh (< 30 min), return the snapshot text
  // If stale or missing, return null (CardDesk falls back to local context)
}
```

This leverages the same Directus instance both apps share. The `ai_context_snapshots` collection is populated by Earnest's Context Broker.

### B. Enrich AI suggestion endpoints

Update these endpoints to include Earnest context when available:

**`server/api/ai-suggestions.post.ts`** — Contact next-steps
- Append Earnest org context (clients, projects, invoices, deals) to the prompt
- This lets the AI reference the user's broader business context when suggesting follow-ups
- Example: "This contact's company has an open invoice — consider mentioning it"

**`server/api/ai-lead-suggestions.post.ts`** — Lead prioritization
- Include Earnest's pipeline data (leads collection) alongside CardDesk contacts
- Cross-reference: if a CardDesk contact matches an Earnest lead, merge their data
- This avoids duplicate recommendations and gives richer prioritization signals

**`server/api/ai-insights.post.ts`** — Network insights
- Include project/invoice data from Earnest context
- Enables insights like "Your top 3 clients by revenue are..." and "These contacts have active projects"

### C. Contact-to-lead matching

**File: `server/utils/contact-lead-match.ts`**

Create a utility to match CardDesk contacts with Earnest leads:

```ts
export async function matchContactToLead(contact: CdContact, directus: DirectusClient): Promise<Lead | null> {
  // Match by email (primary), then by company + name (fallback)
  // Returns the Earnest lead record if found
}
```

Use this in:
- The Detail screen: show a badge if the contact has an Earnest lead record
- AI suggestions: merge lead data (stage, estimated value, assigned to) into the prompt
- Pipeline view: show Earnest pipeline stage alongside CardDesk rating

---

## 3. Update the Vibe Screen with Pipeline Insights

### A. Pipeline health card

**File: `app/components/phone/VibeScreen.vue`**

Add a new card to the Vibe feed:

- **Pipeline snapshot** — Show counts per stage + total estimated value
- Highlight stalled deals (contacts in a stage for >7 days with no activity)
- Quick action: "Follow up on stalled deals" → navigates to those contacts

### B. AI lead suggestions on Vibe

The existing AI lead suggestions (`ai-lead-suggestions.post.ts`) should now factor in pipeline stage data. Update the Vibe screen's lead suggestions section to show the contact's pipeline stage badge alongside each suggestion.

---

## 4. Update Session Screen with Pipeline Coaching

### A. Pipeline-aware coaching

**File: `app/components/phone/SessionScreen.vue`**

Update the coaching prompts to include pipeline data:

**`server/api/ai-sayings.post.ts`:**
- Include pipeline stats (how many in each stage, stalled count, recent wins/losses)
- Enable coaching messages like: "You have 3 deals in negotiation — one follow-up could close this week"
- Tough love mode: "4 leads have been 'contacted' for 2 weeks. Move them forward or let them go."
- Hype mode: "You closed 2 deals this month! Your pipeline is hot — keep the momentum!"

---

## 5. Sync Gamification with Earnest Score

CardDesk has its own XP/level/badge system. It should complement (not duplicate) Earnest's Earnest Score.

### A. Display Earnest Score on Account page

**File: `app/components/phone/HomeScreen.vue`** and **`app/pages/account.vue`**

If the user's org has an Earnest Score, show it alongside the CardDesk XP:

- Fetch from Directus: `earnest_scores` collection where `organization = user.org`
- Display: "Earnest Score: 87 — Resolute" with dimension breakdown
- Link or note: "Your CRM activity in CardDesk contributes to this score"

### B. CRM dimension contribution

Earnest Score has a CRM dimension (20 max points) that tracks pipeline activity, follow-up adherence, and conversion rates. CardDesk activities should feed into this:

**Option A (Directus-native):** CardDesk activities (`cd_activities`) are already in Directus. Earnest's score calculation (`server/utils/earnestScore.ts`) can query `cd_activities` as part of the CRM dimension calculation. This requires updating Earnest, not CardDesk.

**Option B (API push):** After logging an activity in CardDesk, POST a summary to a shared Directus collection (e.g., `crm_activity_log`) that Earnest's scorer reads.

Recommend **Option A** since both apps share the same Directus instance.

---

## 6. New Badge Opportunities

### A. Pipeline badges for CardDesk

**File: `app/composables/useXp.ts`**

Add badges that reward pipeline discipline:

| Badge | Condition | XP Bonus |
|-------|-----------|----------|
| `pipeline_builder` | 10+ contacts with a pipeline stage | +75 |
| `qualifier` | Qualify 5 leads (move to "qualified") | +75 |
| `proposal_pro` | Send 3 proposals (move to "proposal_sent") | +75 |
| `deal_closer` | Close 3 deals (move to "won") | +100 |
| `pipeline_honest` | Log 5 lost reasons | +50 |

---

## 7. WebSocket Sync (Optional, Future)

CardDesk already has a WebSocket token endpoint (`/api/websocket/token.get.ts`). If Earnest publishes real-time events (lead stage changes, new AI context snapshots), CardDesk could subscribe:

- Listen for `leads` collection changes → update pipeline view in real time
- Listen for `ai_context_snapshots` changes → refresh cached context
- Listen for `earnest_scores` changes → update score display

This is a nice-to-have and can be deferred.

---

## 8. Environment & Config Updates

### A. No new env vars needed

Both apps already share:
- `DIRECTUS_URL` — same Directus instance
- `ANTHROPIC_API_KEY` — same key (server-side)

### B. Directus collection permissions

Ensure the CardDesk user role has **read** access to:
- `leads` (for pipeline cross-reference)
- `ai_context_snapshots` (for context enrichment)
- `earnest_scores` and `earnest_history` (for score display)
- `clients`, `projects`, `invoices` (for AI context)

These should be read-only from CardDesk's perspective — Earnest owns the writes.

---

## Summary Checklist

### Pipeline Integration
- [ ] Add pipeline_stage, earnest_lead_id, estimated_value fields to cd_contacts (Directus + types)
- [ ] Add pipeline toggle to ContactsScreen (mobile Kanban lanes)
- [ ] Add stage management to DetailScreen (badge + move action + won/lost flows)
- [ ] Add stage_change activity type
- [ ] Add pipeline XP rewards to useXp.ts
- [ ] Create usePipeline.ts composable

### AI Context Integration
- [ ] Create server/utils/earnest-context.ts (Context Broker bridge)
- [ ] Enrich ai-suggestions.post.ts with Earnest org context
- [ ] Enrich ai-lead-suggestions.post.ts with Earnest lead data
- [ ] Enrich ai-insights.post.ts with project/invoice data
- [ ] Create server/utils/contact-lead-match.ts (email/name matching)

### UI Updates
- [ ] Add pipeline health card to VibeScreen
- [ ] Show pipeline stage badges on lead suggestions
- [ ] Update SessionScreen coaching with pipeline data
- [ ] Display Earnest Score on Account/Home screen

### Gamification
- [ ] Add pipeline XP rewards (stage progression + deal close)
- [ ] Add 5 pipeline badges
- [ ] Ensure CardDesk activities feed into Earnest Score CRM dimension (Earnest-side change)

### Design System Migration
- [ ] Add Glass theme CSS variables to `carddesk.css` (light + dark mode)
- [ ] Add `.glass`, `.glass-thin`, `.glass-ultra` utility classes
- [ ] Add `.ios-card`, `.ios-group`, `.ios-press` utility classes
- [ ] Add `t-*` semantic utility classes
- [ ] Replace BottomNav.vue with glass pill nav
- [ ] Migrate all buttons to `rounded-full` pill shape
- [ ] Migrate all selects/inputs to `rounded-full`
- [ ] Replace gradient cards with flat `.ios-card` surfaces
- [ ] Remove neon glow shadows, replace with subtle `0 1px 2px rgba(0,0,0,0.04)`
- [ ] Update typography: Proxima Nova body, Bauer Bodoni display, uppercase tracked labels
- [ ] Add hidden scrollbar class to all scroll containers
- [ ] Add spring easing variables and page transitions
- [ ] Update rating pills to opacity-based style
- [ ] Add pipeline stage color tokens (opacity on white, not neon on dark)

### Config
- [ ] Update Directus permissions for CardDesk role (read access to Earnest collections)
- [ ] No new env vars required
