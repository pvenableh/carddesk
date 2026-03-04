import { readMe } from "@directus/sdk"
import { getUserDirectus } from "./directus"

/**
 * Fetches the current user's profile from Directus /users/me,
 * including organization data (uses first org as primary).
 */
export async function fetchUserProfile(token: string) {
  const directus = getUserDirectus(token)
  const me = await directus.request(
    readMe({
      fields: [
        "first_name", "last_name", "title", "industry", "networking_goal",
        { organization: ["name", "industry", "logo", "address"] },
      ],
    }),
  ) as any

  // Organization can be a single object or an array — use first as primary
  let org = me.organization ?? null
  if (Array.isArray(org)) org = org[0] ?? null

  return {
    first_name: me.first_name ?? "",
    last_name: me.last_name ?? "",
    title: me.title ?? "",
    industry: me.industry ?? "",
    networking_goal: me.networking_goal ?? "",
    organization: org,
  }
}
