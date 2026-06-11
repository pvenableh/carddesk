import { createItem } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";
import { SOCIAL_KEYS } from "~/types/socials";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const body = await readBody(event);
  if (!body.name?.trim())
    throw createError({ statusCode: 400, message: "Name is required" });
  const directus = getUserDirectus(token);
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
        ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, body[k] ?? null])),
        industry: body.industry ?? null,
        met_at: body.met_at ?? null,
        location: body.location ?? null,
        address: body.address ?? null,
        rating: body.rating ?? null,
        notes: body.notes ?? null,
        // Provenance: how this contact was acquired, and (for referrals) which
        // existing contact introduced them. Defaults to a manual add.
        source: ['scan', 'manual', 'referral', 'import', 'event'].includes(body.source) ? body.source : 'manual',
        referred_by: body.referred_by ?? null,
        hibernated: false,
      }),
    );
  } catch (err: any) {
    console.error("[POST /api/contacts] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to create contact";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
