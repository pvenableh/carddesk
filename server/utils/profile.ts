import { readMe, readUser } from "@directus/sdk"
import { getDirectus, getUserDirectus } from "./directus"
import { assetUrl } from "./cards"

const PROFILE_FIELDS = [
  "first_name", "last_name", "title", "industry", "networking_goal", "location", "avatar",
  { organizations: [{ organizations_id: ["id", "name", "industry", "logo", "address"] }] },
] as const

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
