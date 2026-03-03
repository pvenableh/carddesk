import { createItem } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: "Not authenticated" });
  const body = await readBody(event);
  if (!body.contact || !body.type || !body.date)
    throw createError({
      statusCode: 400,
      message: "contact, type, and date required",
    });
  const directus = getUserDirectus(session.user.access_token);
  try {
    return await directus.request(
      createItem("cd_activities", {
        contact: body.contact,
        type: body.type,
        label: body.label ?? body.type,
        date: body.date,
        note: body.note ?? null,
        is_response: body.is_response ?? false,
        response_note: body.response_note ?? null,
      }),
    );
  } catch (err: any) {
    console.error("[POST /api/activities] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to log activity";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
