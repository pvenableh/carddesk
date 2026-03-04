import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";

export default defineEventHandler(async (event) => {
  await getValidToken(event);
  const body = await readBody(event);

  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: "Anthropic API key not configured" });

  const { contact, activities, profile } = body;

  const prompt = `You are a networking coach for a professional CRM app. Given this contact and context, suggest exactly 3 specific, actionable next steps the user should take. Each suggestion should be 1-2 sentences, practical, and personalized.

Contact:
- Name: ${contact.name}
- Title: ${contact.title || "Unknown"}
- Company: ${contact.company || "Unknown"}
- Industry: ${contact.industry || "Unknown"}
- Rating: ${contact.rating || "Unrated"}
- Notes: ${contact.notes || "None"}

Activity History:
${activities?.length ? activities.map((a: any) => `- ${a.date}: ${a.label}${a.note ? ` (${a.note})` : ""}${a.is_response ? " [REPLIED]" : ""}`).join("\n") : "No activities logged yet."}
Days since last activity: ${body.daysSinceLastActivity ?? "N/A"}

User Profile:
- Name: ${profile?.full_name || "Unknown"}
- Role: ${profile?.title || "Unknown"}
- Company: ${profile?.company || "Unknown"}
- Industry: ${profile?.industry || "Unknown"}
- Networking Goal: ${profile?.networking_goal || "General networking"}

Return ONLY a JSON array of 3 objects: [{"icon": "emoji", "title": "short title", "body": "1-2 sentence suggestion"}]
Use relevant emoji icons. Be specific — mention names, companies, industries. No generic advice.`;

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
      throw createError({ statusCode: 422, message: "Could not parse AI suggestions" });
    }
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: "AI suggestions failed — try again" });
  }
});
