import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";
import { fetchUserProfile } from "../utils/profile";
import { enforceCredits, chargeCredits } from "../utils/ai-credits";
import { CLAUDE_MODELS } from "../utils/ai-models";

import { logAnthropicError } from "../utils/ai-errors";
import { EARNEST_VOICE_CHARTER } from "../utils/voice";
/**
 * Reconnect re-opener — drafts ONE short, sendable message to restart a quiet
 * relationship. Wired to the Reconnect Roulette reveal: the spin creates the
 * intent, this (metered, 1 credit) removes the "what do I say?" friction.
 * Grounded in the contact's history and the user's own profile/goal so the
 * draft reads like the user, not like a bot.
 */
export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const body = await readBody(event);

  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: "Anthropic API key not configured" });

  const { contact, daysQuiet } = body ?? {};
  if (!contact?.name)
    throw createError({ statusCode: 400, message: "Contact is required" });

  const account = await enforceCredits(event, "ai-reopener");

  let profile: any = null;
  try { profile = await fetchUserProfile(token); } catch { /* proceed without */ }

  const prompt = `You are a networking coach.

${EARNEST_VOICE_CHARTER}

Draft ONE short re-opener message the user can send right now to restart a quiet professional relationship. It must sound like a normal human text/email opener — warm, specific, zero corporate fluff, no apology spiral about the silence. 2-3 sentences max. End with a light, easy-to-answer question or suggestion. Reference only details that actually appear in the contact's data below; do not invent shared history, events, or specifics.

The contact:
- Name: ${contact.name}
- Title: ${contact.title || "Unknown"}
- Company: ${contact.company || "Unknown"}
- Industry: ${contact.industry || "Unknown"}
- Where they met: ${contact.met_at || "Unknown"}
- Rating: ${contact.rating || "Unrated"}
- Notes: ${contact.notes || "None"}
- Last activity: ${contact.lastActivity || "None logged"}
- Days since last touch: ${daysQuiet ?? "Unknown"}

The user (sender):
- Name: ${[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unknown"}
- Role: ${profile?.title || "Unknown"}
- Company: ${profile?.organization?.name || "Unknown"}
- Industry: ${profile?.industry || profile?.organization?.industry || "Unknown"}
- Location: ${profile?.location || profile?.organization?.address || "Unknown"}
- Networking goal: ${profile?.networking_goal || "General networking"}

Return ONLY the message text — no preamble, no quotes, no subject line, no signature.`;

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
      contactId: contact?.id ?? null,
    });
    const message = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("")
      .trim();
    if (!message)
      throw createError({ statusCode: 422, message: "Could not draft a re-opener" });
    return { message };
  } catch (err: any) {
    if (err.statusCode) throw err;
    const detail = logAnthropicError("ai-reopener", err);
    throw createError({ statusCode: 502, message: `Re-opener failed: ${detail}` });
  }
});
