import { canonicalizeIngredientName, guessAisle } from "../../shared/foodDatabase";
import type { ParsedRecipeDraft } from "../../shared/recipeParser";
import { normalizeUnit } from "../../shared/unitConverter";

export const AI_VISION_MODEL = "gpt-6-luna";

const RECIPE_JSON_SCHEMA = {
  name: "extracted_recipe",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "description",
      "sourceHandle",
      "servings",
      "prepMinutes",
      "cookMinutes",
      "tags",
      "ingredients",
      "steps",
    ],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      sourceHandle: { type: "string" },
      servings: { type: "integer" },
      prepMinutes: { type: "integer" },
      cookMinutes: { type: "integer" },
      tags: {
        type: "array",
        items: { type: "string" },
      },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["quantity", "unit", "name", "notes"],
          properties: {
            quantity: { type: ["number", "null"] },
            unit: { type: "string" },
            name: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
      steps: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are an expert culinary editor turning messy recipe screenshots (Instagram posts, Reels captions, TikToks, recipe blogs, handwritten cards) or pasted text into crisp, easy-to-read, cook-ready recipes.

Rules:
- Read ALL provided screenshots and/or text together as a single recipe (for example, slide 1 may have the title/photo, slide 2 ingredients, slide 3 instructions).
- Completely ignore phone status bars, Instagram UI chrome (Like, Comment, Share, Save, Follow, timestamps, view counts, unrelated hashtags).
- If an Instagram/social creator handle like @username is visible, put it in sourceHandle (otherwise "").
- Write a clear, appetizing recipe title and a concise 1-sentence description.
- Estimate reasonable servings (default 4 if unstated), prepMinutes, and cookMinutes if omitted.
- Provide 2–4 clean lowercase tags (e.g. "weeknight", "high-protein", "pasta", "vegetarian").
- Parse every ingredient cleanly:
  - quantity: decimal number (e.g. 1.5 for "1 1/2", 0.25 for "1/4", average for ranges like "2-3" -> 2.5), or null for "to taste".
  - unit: standard short culinary unit ("cup", "tbsp", "tsp", "oz", "lb", "g", "ml", "clove", "can", "bunch", "slice", "each", or "" when quantity is null).
  - name: clean ingredient name WITHOUT quantity, unit, or prep instructions (e.g. "baby spinach", "boneless chicken breast", "extra virgin olive oil").
  - notes: prep details or package size (e.g. "finely diced", "15 oz, drained", "optional", or "").
- Rewrite cooking instructions into clear, legible, step-by-step directions (one logical action per step, no leading step numbers like "1."). Stay faithful to the source recipe without inventing extra ingredients.`;

interface AiExtractedRaw {
  title: string;
  description: string;
  sourceHandle: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: {
    quantity: number | null;
    unit: string;
    name: string;
    notes: string;
  }[];
  steps: string[];
}

export interface StoredImagePayload {
  contentType: string;
  dataBase64: string;
}

export async function extractRecipeWithLuna(params: {
  apiKey: string;
  images: StoredImagePayload[];
  rawText?: string;
}): Promise<{ draft: ParsedRecipeDraft; model: string }> {
  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [];

  if (params.images.length > 0) {
    contentParts.push({
      type: "text",
      text: `Extract the recipe from ${
        params.images.length === 1 ? "this screenshot" : `these ${params.images.length} screenshots`
      } into the structured JSON schema.${
        params.rawText?.trim() ? `\n\nAdditional pasted text:\n${params.rawText.trim()}` : ""
      }`,
    });
    for (const img of params.images) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${img.contentType || "image/jpeg"};base64,${img.dataBase64}`,
          detail: "high",
        },
      });
    }
  } else if (params.rawText?.trim()) {
    contentParts.push({
      type: "text",
      text: `Extract and clean up the following recipe text into the structured JSON schema:\n\n${params.rawText.trim()}`,
    });
  } else {
    throw new Error("Provide at least one screenshot or recipe text to extract.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_VISION_MODEL,
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: RECIPE_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(
      JSON.stringify({
        message: "openai_extract_error",
        status: res.status,
        body: errText.slice(0, 400),
      })
    );
    throw new Error(`OpenAI Vision request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  const raw = JSON.parse(content) as AiExtractedRaw;

  const ingredients = (raw.ingredients ?? [])
    .filter((i) => i.name && i.name.trim().length > 0)
    .map((i) => {
      const cleanName = i.name.trim();
      const unit = normalizeUnit(i.unit || "");
      const canonicalName = canonicalizeIngredientName(cleanName);
      const aisle = guessAisle(cleanName);
      return {
        rawText: `${i.quantity ?? ""} ${unit} ${cleanName}${i.notes ? `, ${i.notes}` : ""}`.trim(),
        quantity: typeof i.quantity === "number" && Number.isFinite(i.quantity) ? i.quantity : null,
        unit: unit || (i.quantity !== null ? "each" : ""),
        name: cleanName,
        canonicalName,
        aisle,
        notes: (i.notes || "").trim(),
      };
    });

  const steps = (raw.steps ?? [])
    .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean);

  const draft: ParsedRecipeDraft = {
    title: (raw.title || "Untitled Recipe").trim(),
    description: (raw.description || "").trim().slice(0, 400),
    sourceHandle: (raw.sourceHandle || "").trim(),
    servings: Math.max(1, Math.min(32, Math.round(raw.servings || 4))),
    prepMinutes: Math.max(0, Math.min(600, Math.round(raw.prepMinutes ?? 10))),
    cookMinutes: Math.max(0, Math.min(1440, Math.round(raw.cookMinutes ?? 20))),
    tags: (raw.tags ?? [])
      .map((t) => t.replace(/^#/, "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6),
    ingredients,
    steps,
  };

  return {
    draft,
    model: data.model || AI_VISION_MODEL,
  };
}
