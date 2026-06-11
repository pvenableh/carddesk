export interface DirectusSchema {
  cd_contacts: CdContact[]
  cd_activities: CdActivity[]
  cd_xp_state: CdXpState[]
  cd_ai_usage_logs: CdAiUsageLog[]
  cd_credit_accounts: CdCreditAccount[]
  cd_credit_purchases: CdCreditPurchase[]
  cd_sessions: CdSession[]
  cd_plans: CdPlan[]
  cd_tasks: CdTask[]
  cd_feedback: CdFeedback[]
  cd_connections: CdConnection[]
  cd_invites: CdInvite[]
  cd_cards: CdCard[]
  cd_feed_events: CdFeedEvent[]
  cd_reactions: CdReaction[]
}

export interface CdCard {
  id: string
  user: string
  display_name?: string | null
  title?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  linkedin?: string | null
  instagram?: string | null
  twitter?: string | null
  youtube?: string | null
  behance?: string | null
  headline?: string | null
  office_address?: string | null
  image?: string | null
  broadcast_activity?: boolean
  date_created?: string
  date_updated?: string
}

export type FeedVisibility = 'private' | 'connections' | 'public'
export type FeedEventType = 'card_scanned' | 'level_up' | 'streak' | 'badge' | 'connected' | 'joined' | 'intro' | 'revival'

export interface CdFeedEvent {
  id: string
  actor: string
  type: FeedEventType
  visibility: FeedVisibility
  payload?: Record<string, any> | null
  date_created: string
}

export interface CdReaction {
  id: string
  user: string
  event: string
  emoji: string
  date_created: string
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

export interface CdConnection {
  id: string
  date_created: string
  date_updated: string
  requester: string
  addressee: string
  status: ConnectionStatus
}

export interface CdInvite {
  id: string
  date_created: string
  inviter: string
  code: string
  accepted_by?: string | null
  accepted_at?: string | null
  expires_at?: string | null
  /** cd_contacts id this invite was aimed at (contact-targeted invite). */
  contact?: string | null
  /** Email the invite was sent to (contact-targeted invites). */
  target_email?: string | null
}

export interface CdSessionMessage {
  role: 'user' | 'assistant'
  content: any
  ai_generated?: boolean
  ts?: string
}

export interface CdSession {
  id: string
  user_created: string
  date_created: string
  contact?: string | CdContact | null
  type: 'coaching' | 'suggestions' | 'lead_review' | 'insights' | 'note' | 'event' | 'chat'
  title: string
  summary?: string | null
  messages: CdSessionMessage[]
  is_pinned?: boolean
}

export type PlanStatus = 'active' | 'done' | 'archived'

/**
 * A "plan of attack" — a named, ordered group of follow-up tasks for advancing
 * one contact. Usually generated from an Earnest AI chat (see source_session),
 * but can be created by hand. The plan is a thin grouping; the tasks carry the
 * dates and get checked off.
 */
export interface CdPlan {
  id: string
  /** Owner (directus_users id). Set server-side; every read is scoped to it. */
  user: string
  /** cd_contacts id this plan is for. Null = general / portfolio-wide. */
  contact?: string | null
  title: string
  status: PlanStatus
  /** cd_sessions id (chat) this plan was generated from, if any. */
  source_session?: string | null
  date_created?: string
  date_updated?: string
  /** Hydrated client-side when a plan is loaded with its tasks. */
  tasks?: CdTask[]
}

export type TaskChannel = 'email' | 'linkedin' | 'call' | 'meet' | 'other'
export type TaskStatus = 'pending' | 'done' | 'skipped'

/**
 * A single follow-up task — the durable, checkable unit. Belongs to an optional
 * plan. `due_at` + `user` drive the contact widget, the Vibe "On deck" agenda,
 * and a future union into Earnest's calendar.
 */
export interface CdTask {
  id: string
  user: string
  /** cd_plans id this task belongs to. Null = standalone one-off task. */
  plan?: string | null
  /** cd_contacts id this task is about. Null = general. */
  contact?: string | null
  title: string
  channel?: TaskChannel | null
  note?: string | null
  /** When this task is due (ISO). Null = someday / no date. */
  due_at?: string | null
  status: TaskStatus
  completed_at?: string | null
  /** Order within the plan. */
  sort?: number | null
  source_session?: string | null
  date_created?: string
  date_updated?: string
}

export interface CdFeedback {
  id: string
  user_created: string
  date_created: string
  contact?: string | CdContact | null
  session?: string | CdSession | null
  rating?: 'up' | 'down' | null
  source?: string | null
  outcome?: 'acted' | 'ignored' | 'worked' | 'didnt_work' | null
  note?: string | null
}

export type PipelineStage = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiating' | 'won' | 'lost'

export interface CdContact {
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
  linkedin?: string
  instagram?: string
  twitter?: string
  youtube?: string
  behance?: string
  industry?: string
  met_at?: string
  /** Short city / region (e.g. "Austin, TX") — feeds AI analysis. */
  location?: string
  /** Full mailing address. */
  address?: string
  rating: 'hot' | 'warm' | 'nurture' | 'cold' | null
  hibernated: boolean
  hibernated_at?: string
  is_client: boolean
  client_at?: string
  notes?: string
  /** Contact photo: Directus file id (`image`) + resolved URL (`imageUrl`). */
  image?: string | null
  imageUrl?: string | null
  activities?: CdActivity[]
  pipeline_stage?: PipelineStage
  earnest_lead_id?: string
  estimated_value?: number
  lost_reason?: string
  /** Directus user id if this contact joined CardDesk (stamped on invite redemption). */
  linked_user?: string | null
  /** How this contact was acquired. */
  source?: 'scan' | 'manual' | 'referral' | 'import' | 'event' | null
  /** cd_contacts id of the contact who introduced/spawned this one (referral graph). */
  referred_by?: string | null
}

export interface CdActivity {
  id: string
  user_created: string
  date_created: string
  contact: string | CdContact
  type: 'email' | 'text' | 'call' | 'meeting' | 'linkedin' | 'other' | 'contact_added' | 'card_scanned' | 'converted_client' | 'stage_change' | 'converted_lead'
  label: string
  date: string
  note?: string
  is_response: boolean
  response_note?: string
}

export interface CdXpState {
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
  streak_shields?: number
  hype_date?: string | null
  quiz_date?: string | null
  /** Count of this user's invites that were accepted (someone joined via their link). */
  invites_accepted?: number
}

// Per-user AI credit balance for standalone (non-Earnest-org) users.
// Admin-managed, user-read-only — users cannot self-edit their balance.
// Org-backed users draw from organizations.ai_token_balance instead.
export interface CdCreditAccount {
  id: string
  user: string
  date_created: string
  ai_credit_balance: number
  ai_credits_used_total: number
  ai_credits_used_this_period: number
  ai_credit_period_start?: string | null
  free_credits_granted: boolean
  stripe_customer_id?: string | null
}

export interface CdCreditPurchase {
  id: string
  user: string
  date_created: string
  stripe_session_id: string
  stripe_payment_intent?: string | null
  package_id?: string | null
  credits: number
  amount_cents: number
  currency: string
  status: 'paid' | 'pending' | 'failed'
}

export interface CdAiUsageLog {
  id: string
  user: string
  date_created: string
  endpoint: string
  model: string
  input_tokens: number
  output_tokens: number
  total_tokens: number
  credits_charged: number
  estimated_cost: number
  billed_to: 'user' | 'org'
  organization?: string | null
  contact?: string | CdContact | null
  session_id?: string | null
  metadata?: Record<string, any> | null
}

export interface CdUserProfile {
  first_name?: string
  last_name?: string
  title?: string
  industry?: string
  networking_goal?: string
  location?: string
  discoverable?: boolean
  /** Resolved URL of the user's Earnest (Directus) avatar, or null. */
  avatarUrl?: string | null
  organization?: {
    id?: number
    name?: string
    industry?: string
    logo?: string
    address?: string
  } | null
}
