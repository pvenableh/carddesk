import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";
import { fetchUserProfile } from "../utils/profile";
import { getEarnestContext } from "../utils/earnest-context";
import { enforceCredits, chargeCredits } from "../utils/ai-credits";
import { CLAUDE_MODELS } from "../utils/ai-models";

import { logAnthropicError } from "../utils/ai-errors";
export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: "Anthropic API key not configured" });

  const account = await enforceCredits(event, "ai-insights");

  let profile: Record<string, any> = {};
  try {
    profile = await fetchUserProfile(token);
  } catch { /* use empty defaults */ }

  // Fetch Earnest org context if available
  let earnestContext = "";
  try {
    const orgId = profile?.organization?.id;
    if (orgId) {
      const ctx = await getEarnestContext(String(orgId));
      if (ctx) earnestContext = `\n\nEarnest Business Context (projects, invoices, clients):\n${ctx}`;
    }
  } catch { /* proceed without */ }

  const body = await readBody(event);
  const { industries, channels, ratings, responseRate, contacts, xp, pipeline } = body;

  const prompt = `You are a sharp networking strategist inside a CRM app called CardDesk. Analyze this user's network data and give exactly 4 personalized insights — specific, actionable observations about their network with advice on how to connect better.

Each insight should be a single punchy sentence with a specific recommendation. Reference real numbers and industries from their data.

User Profile:
- Name: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown"}
- Role: ${profile.title || "Unknown"}
- Company: ${profile.organization?.name || "Unknown"}
- Industry: ${profile.industry || profile.organization?.industry || "Unknown"}
- Goal: ${profile.networking_goal || "General networking"}

Network Breakdown by Industry:
${industries?.length ? industries.map((i: any) => `- ${i.name}: ${i.count} contacts (${i.hot} hot, ${i.clients} clients)`).join("\n") : "No industry data available."}

Communication Channels Used:
${channels?.length ? channels.map((c: any) => `- ${c.type}: ${c.count} touchpoints (${c.responses} got replies)`).join("\n") : "No activity data."}

Rating Distribution:
${ratings ? `- Hot: ${ratings.hot}, Warm: ${ratings.warm}, Nurture: ${ratings.nurture}, Cold: ${ratings.cold}, Unrated: ${ratings.unrated}` : "No data."}

Response Rate: ${responseRate ?? "N/A"}%
Total Contacts: ${contacts?.total ?? 0}
Total Clients: ${contacts?.clients ?? 0}
Streak: ${xp?.streak ?? 0} days

Pipeline:
${pipeline ? Object.entries(pipeline).map(([stage, count]) => `- ${stage}: ${count}`).join("\n") : "No pipeline data."}
Total Pipeline Value: $${body.pipelineValue ?? 0}
Stalled Deals: ${body.stalledCount ?? 0}
${earnestContext}

Focus on:
1. Which industries they're strongest/weakest in and what to do about it
2. Which communication channels get the best response rates for them
3. Opportunities they're missing (cold contacts, unrated leads, industries to explore, stalled pipeline deals)
4. Pipeline health — stalled deals, conversion patterns, and revenue potential

Return ONLY a JSON array of 4 objects: [{"icon": "emoji", "title": "short title (3-5 words)", "body": "1 sentence insight with specific advice"}]
Be direct and specific. Reference actual numbers. No generic advice.`;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODELS.default,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    // Charge on any completed Anthropic response, even if parsing fails below.
    chargeCredits(account, {
      model: CLAUDE_MODELS.default,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(clean);
    } catch {
      throw createError({ statusCode: 422, message: "Could not parse AI insights" });
    }
  } catch (err: any) {
    if (err.statusCode) throw err;
    const detail = logAnthropicError("ai-insights", err);
    throw createError({ statusCode: 502, message: `AI insights failed: ${detail}` });
  }
});
