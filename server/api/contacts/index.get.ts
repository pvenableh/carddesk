import { readItems } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: "Not authenticated" });
  const directus = getUserDirectus(session.user.access_token);
  try {
    return await directus.request(
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
          "industry",
          "met_at",
          "rating",
          "hibernated",
          "hibernated_at",
          "notes",
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
    );
  } catch (err: any) {
    console.error("[GET /api/contacts] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to load contacts";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
