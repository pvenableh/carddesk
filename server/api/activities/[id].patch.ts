import { updateItem } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 400, message: "Activity ID required" });
  const body = await readBody(event);
  const directus = getUserDirectus(token);

  // Build update payload — only include fields that were sent
  const updates: Record<string, any> = {};
  if (body.type !== undefined) updates.type = body.type;
  if (body.label !== undefined) updates.label = body.label;
  if (body.date !== undefined) updates.date = body.date;
  if (body.note !== undefined) updates.note = body.note;
  if (body.is_response !== undefined) updates.is_response = body.is_response;
  if (body.response_note !== undefined) updates.response_note = body.response_note;

  if (!Object.keys(updates).length)
    throw createError({ statusCode: 400, message: "No fields to update" });

  try {
    return await directus.request(
      updateItem("cd_activities", id, updates),
    );
  } catch (err: any) {
    console.error("[PATCH /api/activities] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to update activity";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
