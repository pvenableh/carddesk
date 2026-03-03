import { readItems } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: "Not authenticated" });
  const directus = getUserDirectus(session.user.access_token);
  try {
    const items = await directus.request(
      readItems("cd_xp_state", {
        filter: { user_created: { _eq: "$CURRENT_USER" } },
        limit: 1,
        sort: ["-date_created"],
      }),
    );
    if (!items?.length) return null;
    const r = items[0] as any;
    return {
      id: r.id,
      total_xp: r.total_xp ?? 0,
      level: r.level ?? 1,
      streak: r.streak ?? 0,
      last_activity_date: r.last_activity_date ?? "",
      total_scans: r.total_scans ?? 0,
      total_contacts: r.total_contacts ?? 0,
      fast_followups: r.fast_followups ?? 0,
      hot_responses: r.hot_responses ?? 0,
      intros: r.intros ?? 0,
      unlocked_badges: r.unlocked_badges ?? [],
      completed_missions: r.completed_missions ?? [],
      missions_date: r.missions_date ?? "",
    };
  } catch {
    return null;
  }
});
