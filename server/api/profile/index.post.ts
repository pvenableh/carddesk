import { updateMe } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const body = await readBody(event);
  const directus = getUserDirectus(token);
  const payload: Record<string, any> = {};
  if (body.first_name !== undefined) payload.first_name = body.first_name;
  if (body.last_name !== undefined) payload.last_name = body.last_name;
  if (body.title !== undefined) payload.title = body.title;
  if (body.industry !== undefined) payload.industry = body.industry;
  if (body.networking_goal !== undefined) payload.networking_goal = body.networking_goal;
  try {
    await directus.request(updateMe(payload));
    return { ok: true };
  } catch (err: any) {
    console.error("[POST /api/profile] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to save profile";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
