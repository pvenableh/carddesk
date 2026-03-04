import { updateItem } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 400, message: "Contact ID required" });
  const body = await readBody(event);
  const directus = getUserDirectus(token);
  try {
    return await directus.request(updateItem("cd_contacts", id, body));
  } catch (err: any) {
    console.error("[PATCH /api/contacts] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to update contact";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
