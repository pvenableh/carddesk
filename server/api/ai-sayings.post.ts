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
  const { mode, contacts, xp } = body;

  const toughPrompt = `You are a direct, no-nonsense networking coach. Generate exactly 3 "tough love" motivational cards for a professional who needs a push to follow up with their network. Each card should have a punchy quote and a follow-up body that's 1-2 sentences.

Personalize based on their real data:
- Name: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "You"}
- Role: ${profile.title || "a professional"}
- Industry: ${profile.industry || "their industry"}
- Goal: ${profile.networking_goal || "growing their network"}
- Hot leads: ${contacts?.hot ?? 0}
- Overdue: ${contacts?.overdue ?? 0}
- Streak: ${xp?.streak ?? 0} days

Reference specific numbers and their goal. Be direct but caring. Use <em> and <strong> HTML tags for emphasis in the body.

Return ONLY a JSON array: [{"q": "punchy quote", "b": "1-2 sentence body with <em>/<strong> tags"}]`;

  const hypePrompt = `You are an incredibly supportive, hype-man networking coach. Generate exactly 3 celebration/encouragement cards for a professional who's doing great at networking. Each card should have an uplifting quote and a body that makes them feel like a rockstar.

Personalize based on their real data:
- Name: ${[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "You"}
- Role: ${profile.title || "a professional"}
- Industry: ${profile.industry || "their industry"}
- Goal: ${profile.networking_goal || "growing their network"}
- Total contacts: ${contacts?.total ?? 0}
- Clients: ${contacts?.clients ?? 0}
- Streak: ${xp?.streak ?? 0} days
- Level: ${xp?.level ?? 1}

Reference specific numbers and achievements. Make them feel unstoppable. Use <em> and <strong> HTML tags for emphasis in the body.

Return ONLY a JSON array: [{"q": "uplifting quote", "b": "1-2 sentence body with <em>/<strong> tags"}]`;

  const prompt = mode === 'tough' ? toughPrompt : hypePrompt;

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
      throw createError({ statusCode: 422, message: "Could not parse AI sayings" });
    }
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({ statusCode: 500, message: "AI sayings failed — try again" });
  }
});
