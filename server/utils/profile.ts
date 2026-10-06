import { readMe, readUser } from "@directus/sdk"
import { getDirectus, getUserDirectus } from "./directus"
import { assetUrl } from "./cards"

const PROFILE_FIELDS = [
  "first_name", "last_name", "title", "industry", "networking_goal", "location", "avatar",
  { organizations: [{ organizations_id: ["id", "name", "industry_key", "logo", "address"] }] },
] as const

/**
 * Labels for `organizations.industry_key` — copied from the Earnest repo's
 * `shared/industries.ts` (the app-owned list that replaced the dropped
 * `organizations.industry` CMS FK). Keep in sync if Earnest adds keys; an
 * unknown key just yields no label.
 */
const ORG_INDUSTRY_LABELS: Record<string, string> = {
  "architecture-construction": "Architecture & Construction",
  "arts-culture-nonprofit": "Arts, Culture & Nonprofit",
  "fashion-retail": "Fashion & Retail",
  "government-community-development": "Government & Community Development",
  "hospitality-events": "Hospitality & Events",
  "marketing-communications": "Marketing & Communications",
  "professional-services": "Professional Services",
  "real-estate-development": "Real Estate & Development",
  tech: "Technology & SaaS",
  accounting: "Accounting & Bookkeeping",
  legal: "Law",
  consulting: "Consulting",
  "financial-advice": "Financial Advice",
  engineering: "Engineering",
  builders: "Builders & Contractors",
  "it-services": "IT Services",
  dental: "Dental",
  medical: "Medical Clinic",
  therapy: "Therapy & Counseling",
  "physio-chiro": "Physical Therapy & Chiropractic",
  "salon-barber": "Salon & Barber",
  "spa-wellness": "Spa & Wellness",
  fitness: "Fitness & Personal Training",
  "yoga-pilates": "Yoga & Pilates",
  coaching: "Coaching",
  tutoring: "Tutoring & Lessons",
  "pet-care": "Veterinary & Pet Care",
  repair: "Repair Shop",
  photography: "Photography",
  retail: "Retail Store",
  "online-store": "Online Store",
  "bakery-cafe": "Bakery & Café",
  restaurant: "Restaurant",
  florist: "Florist",
  trades: "Plumbing, Electrical & HVAC",
  "home-services": "Cleaning & Landscaping",
  auto: "Auto Repair",
}

function emptyProfile() {
  return {
    first_name: "", last_name: "", title: "", industry: "",
    networking_goal: "", location: "", organization: null, avatarUrl: null as string | null,
  }
}

/**
 * Fetches the caller's own profile (first_name, industry, primary org, …).
 *
 * The CardDesk *user* policy doesn't expose these directus_users fields to the
 * user's own token — a user-token readMe returns them blank for standalone
 * (non-Earnest) accounts (the same gap documented for `discoverable`). So we
 * resolve the id from their token (id IS readable), then read the full record
 * with the admin token. Only ever the caller's own profile — no cross-user access.
 */
export async function fetchUserProfile(token: string) {
  const meId = (await getUserDirectus(token).request(readMe({ fields: ["id"] as any }))) as any
  const id = meId?.id
  if (!id) return emptyProfile()

  const me = (await getDirectus().request(
    readUser(id, { fields: PROFILE_FIELDS as unknown as string[] }),
  )) as any

  // M2M junction: organizations is [{organizations_id: {...}}, ...]; first = primary.
  let org = null
  if (Array.isArray(me.organizations) && me.organizations.length > 0) {
    const first = me.organizations[0]
    org = first?.organizations_id ?? first ?? null
  }
  // Callers (account page, AI prompts) read `organization.industry` as a display string.
  if (org) {
    const { industry_key, ...rest } = org
    org = { ...rest, industry: (industry_key && ORG_INDUSTRY_LABELS[industry_key]) || null }
  }

  return {
    first_name: me.first_name ?? "",
    last_name: me.last_name ?? "",
    title: me.title ?? "",
    industry: me.industry ?? "",
    networking_goal: me.networking_goal ?? "",
    location: me.location ?? "",
    organization: org,
    avatarUrl: assetUrl(me.avatar ?? null),
  }
}
