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
  const { contacts, recentActivity, xp } = body;

  const prompt = `You are a sharp, motivating networking coach inside a CRM app called CardDesk. The user wants to know what they should do next to grow their leads and pipeline. Based on their profile, contacts, recent activity, and progress — give exactly 3 specific, actionable suggestions for growing their leads.

Be direct, specific, and reference real data from their profile. Keep the tone punchy and confident — like a coach who knows their stuff. Each suggestion should be 1-2 sentences max.

User Profile:
- Name: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown"}
- Role: ${profile.title || "Unknown"}
- Company: ${profile.organization?.name || "Unknown"}
- Industry: ${profile.industry || profile.organization?.industry || "Unknown"}
- Location: ${profile.location || profile.organization?.address || "Unknown"}
- Networking Goal: ${profile.networking_goal || "General networking"}

Portfolio Summary:
- Total contacts: ${contacts?.total ?? 0}
- Hot leads: ${contacts?.hot ?? 0}
- Warm leads: ${contacts?.warm ?? 0}
- Cold contacts: ${contacts?.cold ?? 0}
- Clients: ${contacts?.clients ?? 0}
- Overdue follow-ups: ${contacts?.overdue ?? 0}

Recent Activity (last 5):
${recentActivity?.length ? recentActivity.map((a: any) => `- ${a.date}: ${a.type} with ${a.contactName}${a.note ? ` (${a.note})` : ""}${a.isResponse ? " [REPLIED]" : ""}`).join("\n") : "No recent activity."}

Progress:
- Level: ${xp?.level ?? 1} (${xp?.levelTitle ?? "Rookie"})
- Total XP: ${xp?.totalXp ?? 0}
- Streak: ${xp?.streak ?? 0} days

Return ONLY a JSON array of 3 objects: [{"icon": "emoji", "title": "short title (3-5 words)", "body": "1-2 sentence suggestion"}]
Use relevant emoji icons. Be specific — mention numbers, contact names if provided, and concrete actions. No generic advice.`;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(clean);
    } catch {
      throw createError({ statusCode: 422, message: "Could not parse AI lead suggestions" });
    }
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: "AI lead suggestions failed — try again" });
  }
});
