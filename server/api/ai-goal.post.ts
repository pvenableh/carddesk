import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";
import { fetchUserProfile } from "../utils/profile";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: "Anthropic API key not configured" });

  let profile: Record<string, any> = {};
  try {
    profile = await fetchUserProfile(token);
  } catch { /* use empty defaults */ }

  const body = await readBody(event);
  const contactCount = body.contactCount ?? 0;
  const clientCount = body.clientCount ?? 0;

  const prompt = `You are a networking coach. Based on this professional's profile, suggest a clear, actionable networking goal in 2-3 sentences. Be specific and motivating — reference their role, industry, and company if available. This will be saved as their networking goal.

Profile:
- Name: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown"}
- Role: ${profile.title || "Unknown"}
- Company: ${profile.organization?.name || "Unknown"}
- Industry: ${profile.industry || profile.organization?.industry || "Unknown"}
- Location: ${profile.location || profile.organization?.address || "Unknown"}
- Current contacts: ${contactCount}
- Current clients: ${clientCount}
- Current goal: ${profile.networking_goal || "None set"}

Return ONLY the goal text — no quotes, no preamble, no explanation. Just the 2-3 sentence goal.`;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("")
      .trim();
    return { goal: text };
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: "AI goal suggestion failed" });
  }
});
