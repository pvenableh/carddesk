import { getValidToken } from "../../utils/auth";
import { fetchUserProfile } from "../../utils/profile";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  try {
    return await fetchUserProfile(token);
  } catch (err: any) {
    console.error("[GET /api/profile] Directus error:", err?.errors ?? err?.message ?? err);
    return null;
  }
});
