export interface DirectusSchema {
  cd_contacts: CdContact[]
  cd_activities: CdActivity[]
  cd_xp_state: CdXpState[]
  cd_ai_usage_logs: CdAiUsageLog[]
  cd_credit_accounts: CdCreditAccount[]
  cd_credit_purchases: CdCreditPurchase[]
  cd_sessions: CdSession[]
  cd_feedback: CdFeedback[]
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
  type: 'coaching' | 'suggestions' | 'lead_review' | 'insights' | 'note'
  title: string
  summary?: string | null
  messages: CdSessionMessage[]
  is_pinned?: boolean
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
  industry?: string
  met_at?: string
  rating: 'hot' | 'warm' | 'nurture' | 'cold' | null
  hibernated: boolean
  hibernated_at?: string
  is_client: boolean
  client_at?: string
  notes?: string
  activities?: CdActivity[]
  pipeline_stage?: PipelineStage
  earnest_lead_id?: string
  estimated_value?: number
  lost_reason?: string
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
  organization?: {
    id?: number
    name?: string
    industry?: string
    logo?: string
    address?: string
  } | null
}
