import { updateItems } from "@directus/sdk";
import { getUserDirectus } from "../../utils/directus";
import { getValidToken } from "../../utils/auth";

/**
 * Bulk re-tag: move every contact tagged with one event name (`met_at`) onto
 * another in a single Directus call. Backs the "rename event" flow, which would
 * otherwise fire one PATCH per attendee. Ownership is enforced by the user
 * token's read/update permissions (Carddesk User policy is scoped to
 * $CURRENT_USER), so a filter on met_at only touches the caller's contacts.
 */
export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const body = await readBody(event);
  const oldName = typeof body?.oldName === "string" ? body.oldName : "";
  const newName = typeof body?.newName === "string" ? body.newName.trim() : "";
  if (!oldName || !newName)
    throw createError({ statusCode: 400, message: "oldName and newName required" });

  const directus = getUserDirectus(token);
  try {
    const updated = await directus.request(
      updateItems(
        "cd_contacts",
        { filter: { met_at: { _eq: oldName } } },
        { met_at: newName },
      ),
    );
    return { updated: Array.isArray(updated) ? updated.length : 0 };
  } catch (err: any) {
    console.error("[POST /api/contacts/retag-event] Directus error:", err?.errors ?? err?.message ?? err);
    const msg = err?.errors?.[0]?.message ?? err?.message ?? "Failed to re-tag contacts";
    throw createError({ statusCode: err?.status ?? 500, message: msg });
  }
});
