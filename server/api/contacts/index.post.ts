import { createItem } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: "Not authenticated" });
  const body = await readBody(event);
  if (!body.name?.trim())
    throw createError({ statusCode: 400, message: "Name is required" });
  const directus = getUserDirectus(session.user.access_token);
  try {
    return await directus.request(
      createItem("cd_contacts", {
        name: body.name.trim(),
        first_name: body.first_name ?? null,
        last_name: body.last_name ?? null,
        title: body.title ?? null,
        company: body.company ?? null,
        email: body.email ?? null,
        phone: body.phone ?? null,
        industry: body.industry ?? null,
        met_at: body.met_at ?? null,
        rating: body.rating ?? null,
        notes: body.notes ?? null,
        hibernated: false,
      }),
    );
  } catch (err: any) {
    console.error("[POST /api/contacts] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to create contact";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
