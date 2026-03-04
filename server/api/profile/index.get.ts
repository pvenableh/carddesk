import { readItems } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const directus = getUserDirectus(token);
  try {
    const items = await directus.request(
      readItems("cd_user_profile", {
        filter: { user_created: { _eq: "$CURRENT_USER" } },
        limit: 1,
      }),
    );
    if (!items?.length) return null;
    const r = items[0] as any;
    return {
      id: r.id,
      full_name: r.full_name ?? "",
      title: r.title ?? "",
      company: r.company ?? "",
      industry: r.industry ?? "",
      networking_goal: r.networking_goal ?? "",
    };
  } catch (err: any) {
    console.error("[GET /api/profile] Directus error:", err?.errors ?? err?.message ?? err);
    return null;
  }
});
