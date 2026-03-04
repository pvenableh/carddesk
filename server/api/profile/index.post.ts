import { createItem, updateItem, readItems } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const body = await readBody(event);
  const directus = getUserDirectus(token);
  const payload = {
    full_name: body.full_name ?? "",
    title: body.title ?? "",
    company: body.company ?? "",
    industry: body.industry ?? "",
    networking_goal: body.networking_goal ?? "",
  };
  try {
    const existing = await directus.request(
      readItems("cd_user_profile", {
        filter: { user_created: { _eq: "$CURRENT_USER" } },
        limit: 1,
        fields: ["id"],
      }),
    );
    if (existing?.length)
      return await directus.request(
        updateItem("cd_user_profile", (existing[0] as any).id, payload),
      );
    return await directus.request(createItem("cd_user_profile", payload));
  } catch (err: any) {
    console.error("[POST /api/profile] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to save profile";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
