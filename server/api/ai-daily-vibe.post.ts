import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";
import { fetchUserProfile } from "../utils/profile";
import { getEarnestContext } from "../utils/earnest-context";
import { enforceCredits, chargeCredits } from "../utils/ai-credits";
import { CLAUDE_MODELS } from "../utils/ai-models";

import { logAnthropicError } from "../utils/ai-errors";
/**
 * Earnest AI "Daily Vibe" — a short, personalized pep-talk for the Vibe screen.
 * Replaces the old hardcoded mood rotator. It reads the user's real momentum
 * (streak, leads, overdue follow-ups, week activity) and returns ONE emotional,
 * motivating nudge. This is deliberately distinct from ai-lead-suggestions:
 * that widget is tactical ("call Sarah"), this one is the mood/coach voice
 * ("you're closer than you think — one message").
 */
export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: "Anthropic API key not configured" });

  const account = await enforceCredits(event, "ai-daily-vibe");

  let profile: Record<string, any> = {};
  try {
    profile = await fetchUserProfile(token);
  } catch { /* use empty defaults */ }

  let earnestContext = "";
  try {
    const orgId = profile?.organization?.id;
    if (orgId) {
      const ctx = await getEarnestContext(String(orgId));
      if (ctx) earnestContext = `\n\nEarnest Business Context (org-level):\n${ctx}`;
    }
  } catch { /* proceed without */ }

  const body = await readBody(event);
  const { stats, recentActivity } = body ?? {};

  const firstName = profile.first_name || (profile.name ? String(profile.name).split(" ")[0] : "") || "there";

  const prompt = `You are Earnest — a warm, emotionally-intelligent networking coach inside the CardDesk app. The user just opened their "Vibe" dashboard. Give them ONE short daily check-in: read their real momentum and respond like a coach who actually knows them. This is about mood and motivation, NOT a task list.

Their name is ${firstName}.

Today's momentum:
- Networking streak: ${stats?.streak ?? 0} days
- Level: ${stats?.level ?? 1}${stats?.levelTitle ? ` (${stats.levelTitle})` : ""}
- Total XP: ${stats?.totalXp ?? 0}, this week: ${stats?.weekXp ?? 0} XP
- Touchpoints this week: ${stats?.weekTouchpoints ?? 0}
- Hot leads: ${stats?.hot ?? 0}, warm: ${stats?.warm ?? 0}, cold/quiet: ${stats?.cold ?? 0}
- Overdue follow-ups: ${stats?.overdue ?? 0}
- Total contacts: ${stats?.total ?? 0}
- Did a networking action today: ${stats?.actedToday ? "yes" : "not yet"}

Recent activity (most recent first):
${recentActivity?.length ? recentActivity.map((a: any) => `- ${a.type} with ${a.contactName}${a.isResponse ? " [they replied]" : ""}`).join("\n") : "- nothing logged recently"}

VOICE: human, encouraging, specific to their numbers. Never generic. Never a checklist. 1-2 sentences for the body. If they're on a streak, honor it. If they've gone quiet, be gentle, not guilt-trippy. If they have hot leads waiting, give a confident nudge. Lead with their actual situation.

Pick a "mood" that matches their state, one of: "fire" (crushing it / strong streak), "steady" (consistent, encouraging), "gentle" (quiet week, low energy, be kind), "nudge" (hot leads or overdue waiting — motivate action).${earnestContext}

Return ONLY a JSON object: {"mood": "fire|steady|gentle|nudge", "emoji": "a single fitting emoji", "title": "punchy 3-6 word headline", "body": "1-2 warm, specific sentences", "cta": "optional 2-4 word action label or empty string"}`;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODELS.default,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
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
      throw createError({ statusCode: 422, message: "Could not parse daily vibe" });
    }
  } catch (err: any) {
    if (err.statusCode) throw err;
    const detail = logAnthropicError("ai-daily-vibe", err);
    throw createError({ statusCode: 502, message: `Daily vibe failed: ${detail}` });
  }
});
