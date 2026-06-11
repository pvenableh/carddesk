import { readItems } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";
import { assetUrl } from "../../utils/cards";
import { SOCIAL_KEYS } from "~/types/socials";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const directus = getUserDirectus(token);
  try {
    const rows = (await directus.request(
      readItems("cd_contacts", {
        fields: [
          "id",
          "name",
          "first_name",
          "last_name",
          "title",
          "company",
          "email",
          "phone",
          ...SOCIAL_KEYS,
          "industry",
          "met_at",
          "rating",
          "hibernated",
          "hibernated_at",
          "is_client",
          "client_at",
          "notes",
          "image",
          "linked_user",
          "date_created",
          {
            activities: [
              "id",
              "type",
              "label",
              "date",
              "note",
              "is_response",
              "response_note",
              "date_created",
            ],
          },
        ],
        filter: { user_created: { _eq: "$CURRENT_USER" } },
        sort: ["-date_created"],
        limit: 200,
      }),
    )) as any[];
    // Resolve the contact photo file id → absolute asset URL for the client.
    return rows.map((c) => ({ ...c, imageUrl: assetUrl(c.image) }));
  } catch (err: any) {
    console.error("[GET /api/contacts] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to load contacts";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
