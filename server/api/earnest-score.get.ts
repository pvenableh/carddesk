import { getValidToken } from "../utils/auth";
import { fetchUserProfile } from "../utils/profile";
import { getEarnestScore } from "../utils/earnest-context";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);

  let profile: Record<string, any> = {};
  try {
    profile = await fetchUserProfile(token);
  } catch {
    throw createError({ statusCode: 500, message: "Could not load profile" });
  }

  const orgId = profile?.organization?.id;
  if (!orgId) return null;

  const score = await getEarnestScore(String(orgId));
  return score;
});
