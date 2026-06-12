import { updateUser } from "@directus/sdk";
import { getDirectus } from "../../utils/directus";
import { getCurrentUserId } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  // Write with the admin token (scoped to the caller's own resolved id): the
  // CardDesk user policy lacks field-level update perms on directus_users, so a
  // user-token updateMe silently fails for standalone accounts (same reason the
  // profile read uses the admin token, and `discoverable` goes through an admin
  // endpoint). Only ever the caller's own row — no cross-user access.
  const me = await getCurrentUserId(event);
  const body = await readBody(event);
  const payload: Record<string, any> = {};
  if (body.first_name !== undefined) payload.first_name = body.first_name;
  if (body.last_name !== undefined) payload.last_name = body.last_name;
  if (body.title !== undefined) payload.title = body.title;
  if (body.industry !== undefined) payload.industry = body.industry;
  if (body.networking_goal !== undefined) payload.networking_goal = body.networking_goal;
  if (body.location !== undefined) payload.location = body.location;
  // NOTE: `discoverable` is intentionally NOT written here — managed via the
  // admin-token endpoints at /api/network/discoverable.
  try {
    await getDirectus().request(updateUser(me, payload));
    return { ok: true };
  } catch (err: any) {
    console.error("[POST /api/profile] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to save profile";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
