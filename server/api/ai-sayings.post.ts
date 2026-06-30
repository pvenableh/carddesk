import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";
import { fetchUserProfile } from "../utils/profile";
import { enforceCredits, chargeCredits } from "../utils/ai-credits";
import { CLAUDE_MODELS } from "../utils/ai-models";

import { logAnthropicError } from "../utils/ai-errors";
import { EARNEST_VOICE_CHARTER } from "../utils/voice";
export default defineEventHandler(async (event) => {
  const token = await getValidToken(event);
  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({ statusCode: 500, message: "Anthropic API key not configured" });

  const account = await enforceCredits(event, "ai-sayings");

  let profile: Record<string, any> = {};
  try {
    profile = await fetchUserProfile(token);
  } catch { /* use empty defaults */ }

  const body = await readBody(event);
  const { mode, contacts, xp, pipeline } = body;

  const pipelineInfo = pipeline
    ? `\nPipeline stats:\n- Contacts in pipeline: ${pipeline.total ?? 0}\n- Open opportunities: ${pipeline.opportunities ?? 0}\n- Stalled: ${pipeline.stalled ?? 0}\n- Clients won: ${pipeline.clients ?? 0}\n- Partners: ${pipeline.partners ?? 0}\n- Not now: ${pipeline.lost ?? 0}\n- Pipeline value: $${pipeline.value ?? 0}`
    : "";

  const toughPrompt = `You are a direct, no-nonsense networking coach.

${EARNEST_VOICE_CHARTER}

Generate exactly 3 "tough love" motivational cards for a professional who needs a push to follow up with their network. Each card should have a punchy quote and a follow-up body that's 1-2 sentences.

Personalize based on their real data:
- Name: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "You"}
- Role: ${profile.title || "a professional"}
- Industry: ${profile.industry || "their industry"}
- Goal: ${profile.networking_goal || "growing their network"}
- Hot leads: ${contacts?.hot ?? 0}
- Overdue: ${contacts?.overdue ?? 0}
- Streak: ${xp?.streak ?? 0} days
${pipelineInfo}

Reference specific numbers and their goal. Include pipeline-aware coaching like "You have X warm contacts — one follow-up could turn one into an opportunity" or "Y opportunities have been quiet for 2 weeks. Make a move or let them go." Be direct but caring. Use <em> and <strong> HTML tags for emphasis in the body.

Return ONLY a JSON array: [{"q": "punchy quote", "b": "1-2 sentence body with <em>/<strong> tags"}]`;

  const hypePrompt = `You are a warm, supportive networking coach.

${EARNEST_VOICE_CHARTER}

Generate exactly 3 genuine celebration/encouragement cards for a professional who's been doing well at networking. Each card should have an uplifting quote and a body that recognizes their real progress. The warmth is real, but the praise must be earned by their actual numbers — celebrate the specific wins in their data rather than declaring them a "rockstar" or "unstoppable".

Personalize based on their real data:
- Name: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "You"}
- Role: ${profile.title || "a professional"}
- Industry: ${profile.industry || "their industry"}
- Goal: ${profile.networking_goal || "growing their network"}
- Total contacts: ${contacts?.total ?? 0}
- Clients: ${contacts?.clients ?? 0}
- Streak: ${xp?.streak ?? 0} days
- Level: ${xp?.level ?? 1}
${pipelineInfo}

Reference their specific, real numbers and achievements — e.g. "You closed <strong>X</strong> deals this month" or "<strong>Y</strong>-day streak and counting". State each win at its true magnitude; don't inflate it. If a number is modest, frame it honestly (progress, not a blowout). Use <em> and <strong> HTML tags for emphasis in the body.

Return ONLY a JSON array: [{"q": "uplifting quote", "b": "1-2 sentence body with <em>/<strong> tags"}]`;

  const prompt = mode === 'tough' ? toughPrompt : hypePrompt;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODELS.default,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    // Charge on any completed Anthropic response, even if parsing fails below.
    chargeCredits(account, {
      model: CLAUDE_MODELS.default,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      metadata: { mode: mode ?? "hype" },
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(clean);
    } catch {
      throw createError({ statusCode: 422, message: "Could not parse AI sayings" });
    }
  } catch (err: any) {
    if (err.statusCode) throw err;
    const detail = logAnthropicError("ai-sayings", err);
    throw createError({ statusCode: 502, message: `AI sayings failed: ${detail}` });
  }
});
