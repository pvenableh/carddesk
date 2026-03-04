import { readMe } from "@directus/sdk"
import { getUserDirectus } from "./directus"

/**
 * Fetches the current user's profile from Directus /users/me,
 * including organization data via M2M junction (first org = primary).
 */
export async function fetchUserProfile(token: string) {
  const directus = getUserDirectus(token)
  const me = await directus.request(
    readMe({
      fields: [
        "first_name", "last_name", "title", "industry", "networking_goal", "location",
        { organizations: [{ organizations_id: ["id", "name", "industry", "logo", "address"] }] },
      ],
    }),
  ) as any

  // M2M junction: organizations is [{organizations_id: {...}}, ...]
  // Use first as primary organization
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
  }
}
