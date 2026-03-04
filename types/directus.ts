export interface DirectusSchema {
  cd_contacts: CdContact[]
  cd_activities: CdActivity[]
  cd_xp_state: CdXpState[]
  cd_user_profile: CdUserProfile[]
}

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
}

export interface CdActivity {
  id: string
  user_created: string
  date_created: string
  contact: string | CdContact
  type: 'email' | 'text' | 'call' | 'meeting' | 'linkedin' | 'other' | 'contact_added' | 'card_scanned' | 'converted_client'
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

export interface CdUserProfile {
  id?: string
  user_created?: string
  full_name?: string
  title?: string
  company?: string
  industry?: string
  networking_goal?: string
}
