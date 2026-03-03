import Anthropic from "@anthropic-ai/sdk";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);
  if (!session?.user?.access_token)
    throw createError({ statusCode: 401, message: "Not authenticated" });
  const { image, mediaType } = await readBody(event);
  if (!image)
    throw createError({ statusCode: 400, message: "No image provided" });
  const config = useRuntimeConfig();
  if (!config.anthropicApiKey)
    throw createError({
      statusCode: 500,
      message: "Anthropic API key not configured",
    });
  const client = new Anthropic({ apiKey: config.anthropicApiKey });
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: image,
              },
            },
            {
              type: "text",
              text: `Extract contact info from this business card. Return ONLY JSON (no markdown):
{
  "first_name": string|null, "last_name": string|null, "name": string|null,
  "title": string|null, "company": string|null, "email": string|null,
  "phone": string|null, "website": string|null, "linkedin": string|null,
  "address": string|null, "industry": string|null
}
Rules: name=full name combined. Industry: infer from context (Technology/Finance/Healthcare/Real Estate/Legal/Marketing/Venture Capital/Other). Return ONLY the JSON.`,
            },
          ],
        },
      ],
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
      linkedin: parsed.linkedin ?? null,
      address: parsed.address ?? null,
      industry: parsed.industry ?? null,
    };
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({
      statusCode: 500,
      message: "Card scan failed — try again",
    });
  }
});
