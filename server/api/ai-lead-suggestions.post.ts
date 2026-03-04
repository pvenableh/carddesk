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
  const { contacts, recentActivity, xp, contactDetails } = body;

  // Build per-contact summaries for the AI
  const contactSummaries = (contactDetails ?? []).map((c: any) => {
    const rating = c.rating || "unrated";
    const isLead = ["hot", "warm"].includes(rating);
    const isClient = c.isClient;
    const status = isClient ? "CLIENT" : isLead ? `LEAD (${rating})` : rating === "nurture" ? "NURTURE" : rating === "cold" ? "COLD" : "NEW CONTACT";
    let line = `- [ID:${c.id}] ${c.name}${c.company ? ` (${c.company})` : ""}${c.title ? ` — ${c.title}` : ""} [${status}]`;
    if (c.industry) line += ` | Industry: ${c.industry}`;
    const channels: string[] = [];
    if (c.hasPhone) channels.push("phone");
    if (c.hasEmail) channels.push("email");
    if (channels.length) line += ` | Channels: ${channels.join(", ")}`;
    if (c.daysSince !== null) line += ` | Last activity: ${c.daysSince} days ago`;
    else line += ` | No activity logged`;
    if (c.followUpStatus === "overdue") line += ` ⚠️ OVERDUE`;
    else if (c.followUpStatus === "due") line += ` ⏰ DUE`;
    if (c.lastActivityType) line += ` | Last: ${c.lastActivityType}${c.lastActivityNote ? ` (${c.lastActivityNote})` : ""}`;
    if (c.lastActivityWasResponse) line += " [THEY REPLIED]";
    return line;
  }).join("\n");

  const prompt = `You are a sharp, motivating networking coach inside a CRM app called CardDesk. The user wants to know what they should do next to grow their leads and pipeline.

YOUR PRIMARY TASK: Look at each of the user's actual contacts below. For contacts that are NOT yet leads (cold, unrated, nurture), suggest specific actions to convert them into warm/hot leads. For contacts that ARE already leads (hot, warm), read their recent activity and suggest the best next step to advance the relationship. For overdue contacts, prioritize them.

Be direct, specific, and ALWAYS reference contacts by name. Keep the tone punchy and confident — like a coach who knows their stuff. Each suggestion should be 1-2 sentences max.

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

CONTACTS (read each one carefully):
${contactSummaries || "No contacts yet."}

Recent Activity (last 5):
${recentActivity?.length ? recentActivity.map((a: any) => `- ${a.date}: ${a.type} with ${a.contactName}${a.note ? ` (${a.note})` : ""}${a.isResponse ? " [REPLIED]" : ""}`).join("\n") : "No recent activity."}

Progress:
- Level: ${xp?.level ?? 1} (${xp?.levelTitle ?? "Rookie"})
- Total XP: ${xp?.totalXp ?? 0}
- Streak: ${xp?.streak ?? 0} days

RULES:
1. ALWAYS mention specific contact names in your suggestions
2. For non-leads: suggest how to turn them into a lead (e.g. "Reach out to [Name] about..." or "Upgrade [Name] to warm — they...")
3. For leads: suggest the next step based on their activity (e.g. "Follow up with [Name] — it's been X days since..." or "[Name] replied — time to propose a meeting")
4. Prioritize overdue and due contacts first
5. If there are no contacts, suggest ways to add new ones
6. For each suggestion, include the contact's ID (from the [ID:xxx] tag) and recommend a specific action type
7. Choose the action based on the contact's available channels and activity pattern:
   - If they replied to an email → suggest "call" to escalate
   - If you last called them → suggest "email" or "text" to follow up
   - If they've gone cold → suggest "text" for a low-pressure check-in
   - If they're a hot lead → suggest "call" to close
   - Only suggest "call" or "text" if they have a phone number, and "email" if they have an email
   - If no contact info is available, use "view" as the action

Return ONLY a JSON array of 3 objects: [{"icon": "emoji", "title": "short title (3-5 words)", "body": "1-2 sentence suggestion", "contactId": "the contact ID from [ID:xxx]", "action": "call|text|email|view"}]
Use relevant emoji icons. Be specific — mention numbers, contact names, and concrete actions. No generic advice.`;

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
