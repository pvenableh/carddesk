import { deleteItem } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 400, message: "Activity ID required" });
  const directus = getUserDirectus(token);
  try {
    await directus.request(deleteItem("cd_activities", id));
    return { deleted: true };
  } catch (err: any) {
    console.error("[DELETE /api/activities] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to delete activity";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
