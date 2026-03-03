import { updateItem } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: "Not authenticated" });
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 400, message: "Activity ID required" });
  const body = await readBody(event);
  const directus = getUserDirectus(session.user.access_token);
  try {
    return await directus.request(
      updateItem("cd_activities", id, {
        is_response: body.is_response ?? true,
        response_note: body.response_note ?? "Responded",
      }),
    );
  } catch (err: any) {
    console.error("[PATCH /api/activities] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to update activity";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
