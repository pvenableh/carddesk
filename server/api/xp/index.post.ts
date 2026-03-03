import { createItem, updateItem, readItems } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: "Not authenticated" });
  const body = await readBody(event);
  const directus = getUserDirectus(session.user.access_token);
  const payload = {
    total_xp: body.total_xp ?? 0,
    level: body.level ?? 1,
    streak: body.streak ?? 0,
    last_activity_date: body.last_activity_date ?? null,
    total_scans: body.total_scans ?? 0,
    total_contacts: body.total_contacts ?? 0,
    fast_followups: body.fast_followups ?? 0,
    hot_responses: body.hot_responses ?? 0,
    intros: body.intros ?? 0,
    unlocked_badges: body.unlocked_badges ?? [],
    completed_missions: body.completed_missions ?? [],
    missions_date: body.missions_date ?? null,
  };
  try {
    const existing = await directus.request(
      readItems("cd_xp_state", {
        filter: { user_created: { _eq: "$CURRENT_USER" } },
        limit: 1,
        fields: ["id"],
      }),
    );
    if (existing?.length)
      return await directus.request(
        updateItem("cd_xp_state", (existing[0] as any).id, payload),
      );
    return await directus.request(createItem("cd_xp_state", payload));
  } catch {
    throw createError({ statusCode: 500, message: "Failed to save XP" });
  }
});
