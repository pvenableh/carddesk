import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";
import { fetchUserProfile } from "../utils/profile";
import { getEarnestContext } from "../utils/earnest-context";
import { enforceCredits, chargeCredits } from "../utils/ai-credits";

export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const body = await readBody(event);

  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: "Anthropic API key not configured" });

  const account = await enforceCredits(event, "ai-suggestions");

  const { contact, activities, profile } = body;

  // Fetch Earnest org context if available
  let earnestContext = "";
  try {
    const userProfile = profile ?? await fetchUserProfile(token);
    const orgId = userProfile?.organization?.id;
    if (orgId) {
      const ctx = await getEarnestContext(String(orgId));
      if (ctx) earnestContext = `\n\nEarnest Business Context (org-level):\n${ctx}`;
    }
  } catch { /* proceed without */ }

  const prompt = `You are a networking coach for a professional CRM app. Given this contact and context, suggest exactly 3 specific, actionable next steps the user should take. Each suggestion should be 1-2 sentences, practical, and personalized.

Contact:
- Name: ${contact.name}
- Title: ${contact.title || "Unknown"}
- Company: ${contact.company || "Unknown"}
- Industry: ${contact.industry || "Unknown"}
- Rating: ${contact.rating || "Unrated"}
- Pipeline Stage: ${contact.pipeline_stage || "Not in pipeline"}
- Estimated Value: ${contact.estimated_value ? "$" + contact.estimated_value.toLocaleString() : "N/A"}
- Notes: ${contact.notes || "None"}

Activity History:
${activities?.length ? activities.map((a: any) => `- ${a.date}: ${a.label}${a.note ? ` (${a.note})` : ""}${a.is_response ? " [REPLIED]" : ""}`).join("\n") : "No activities logged yet."}
Days since last activity: ${body.daysSinceLastActivity ?? "N/A"}

User Profile:
- Name: ${[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unknown"}
- Role: ${profile?.title || "Unknown"}
- Company: ${profile?.organization?.name || "Unknown"}
- Industry: ${profile?.industry || profile?.organization?.industry || "Unknown"}
- Location: ${profile?.location || profile?.organization?.address || "Unknown"}
- Networking Goal: ${profile?.networking_goal || "General networking"}
${earnestContext}

Return ONLY a JSON array of 3 objects: [{"icon": "emoji", "title": "short title", "body": "1-2 sentence suggestion"}]
Use relevant emoji icons. Be specific — mention names, companies, industries. Consider pipeline stage when suggesting next steps. No generic advice.`;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    // Charge on any completed Anthropic response — we paid for the call
    // regardless of whether the model's output parses cleanly.
    chargeCredits(account, {
      model: "claude-sonnet-4-20250514",
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      contactId: contact?.id ?? null,
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
    const detail = err?.error?.error?.message || err?.message || "unknown error";
    console.error("[ai-suggestions] Anthropic error:", err?.status ?? err?.statusCode, detail, err);
    throw createError({ statusCode: 502, message: `AI suggestions failed: ${detail}` });
  }
});
