import Anthropic from "@anthropic-ai/sdk";
import { getValidToken } from "../utils/auth";
import { enforceCredits, chargeCredits } from "../utils/ai-credits";
import { logEarnestAiUsage } from "../utils/earnest-ai-usage";
import { CLAUDE_MODELS } from "../utils/ai-models";
import { logAnthropicError } from "../utils/ai-errors";
import { SOCIAL_KEYS } from "~/types/socials";

export default defineEventHandler(async (event) => {
  await getValidToken(event);
  const body = await readBody(event);

  // Support both { image, mediaType } (legacy) and { images: [{ data, mediaType }] }
  const imageContents: Anthropic.ImageBlockParam[] = [];
  if (body.images && Array.isArray(body.images)) {
    for (const img of body.images) {
      if (!img.data) continue;
      imageContents.push({
        type: "image",
        source: {
          type: "base64",
          media_type: (img.mediaType || "image/jpeg") as "image/jpeg",
          data: img.data,
        },
      });
    }
  } else if (body.image) {
    imageContents.push({
      type: "image",
      source: {
        type: "base64",
        media_type: (body.mediaType || "image/jpeg") as "image/jpeg",
        data: body.image,
      },
    });
  }

  if (!imageContents.length)
    throw createError({ statusCode: 400, message: "No image provided" });

  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({
      statusCode: 500,
      message: "Anthropic API key not configured",
    });

  const account = await enforceCredits(event, "scan-card");

  const socialJson = SOCIAL_KEYS.map((k) => `"${k}": string|null`).join(", ");
  const isMultiSide = imageContents.length > 1;
  const prompt = isMultiSide
    ? `These are photos of the front and back of a business card. Extract and merge all contact info from both sides into a single result. Return ONLY JSON (no markdown):
{
  "first_name": string|null, "last_name": string|null, "name": string|null,
  "title": string|null, "company": string|null, "email": string|null,
  "phone": string|null, "website": string|null, ${socialJson},
  "address": string|null, "industry": string|null
}
Rules: name=full name combined. social handles = the URL or @handle if printed on the card, else null. Industry: infer from context (Technology/Finance/Healthcare/Real Estate/Legal/Marketing/Venture Capital/Other). Merge info from both sides — the front typically has name/title/company, the back may have additional contact details. Return ONLY the JSON.`
    : `Extract contact info from this business card. Return ONLY JSON (no markdown):
{
  "first_name": string|null, "last_name": string|null, "name": string|null,
  "title": string|null, "company": string|null, "email": string|null,
  "phone": string|null, "website": string|null, ${socialJson},
  "address": string|null, "industry": string|null
}
Rules: name=full name combined. social handles = the URL or @handle if printed on the card, else null. Industry: infer from context (Technology/Finance/Healthcare/Real Estate/Legal/Marketing/Venture Capital/Other). Return ONLY the JSON.`;

  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODELS.vision,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            ...imageContents,
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    // Charge on any completed Anthropic response, even if parsing fails below.
    chargeCredits(account, {
      model: CLAUDE_MODELS.vision,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      metadata: { multiSide: isMultiSide },
    });
    // Mirror the real token spend into Earnest's shared org-level rollup
    // (ai_usage_logs). Fire-and-forget — off the scan's hot path.
    logEarnestAiUsage({
      orgId: account.orgId,
      userId: account.userId,
      model: CLAUDE_MODELS.vision,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      endpoint: "carddesk/scan",
      metadata: {
        scanId: response.id ?? null,
        cardId: body.cardId ?? null,
        multiSide: isMultiSide,
      },
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("");
    const clean = text.replace(/```json|```/g, "").trim();
    let parsed: Record<string, string | null>;
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw createError({
        statusCode: 422,
        message: "Could not parse card — try a clearer photo",
      });
    }
    return {
      first_name: parsed.first_name ?? null,
      last_name: parsed.last_name ?? null,
      name:
        parsed.name ??
        ([parsed.first_name, parsed.last_name].filter(Boolean).join(" ") ||
          null),
      title: parsed.title ?? null,
      company: parsed.company ?? null,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      website: parsed.website ?? null,
      ...Object.fromEntries(SOCIAL_KEYS.map((k) => [k, parsed[k] ?? null])),
      address: parsed.address ?? null,
      industry: parsed.industry ?? null,
    };
  } catch (err: any) {
    if (err.statusCode) throw err; // our own 422/402/etc — pass through
    // Surface the real Anthropic error (status + message) instead of a generic
    // 500, so failures are diagnosable in logs and actionable in the UI.
    const detail = logAnthropicError("scan-card", err);
    throw createError({
      statusCode: 502,
      message: `Card scan failed: ${detail}`,
    });
  }
});
