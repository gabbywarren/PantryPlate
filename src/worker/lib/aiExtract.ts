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
- Rewrite cooking instructions into clear, legible, step-by-step directions (one logical action per step, no leading step numbers like "1."), weaving the exact ingredient measurements into each step (e.g. "Sauté 3 cloves minced garlic in 2 tbsp olive oil") so the cook doesn't have to flip back to the ingredient list. Stay faithful to the source recipe without inventing extra ingredients.`;

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

const PANTRY_IDEAS_JSON_SCHEMA = {
  name: "pantry_recipe_ideas",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["recipes"],
    properties: {
      recipes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "description",
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
            servings: { type: "integer" },
            prepMinutes: { type: "integer" },
            cookMinutes: { type: "integer" },
            tags: { type: "array", items: { type: "string" } },
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
            steps: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
} as const;

export async function generateRecipesFromPantryWithLuna(params: {
  apiKey: string;
  pantryLines: string[];
  priorityItems: string[];
  mealType: string;
  maxMinutes: number;
  strictMode: boolean;
  craving: string;
}): Promise<{ drafts: ParsedRecipeDraft[]; model: string }> {
  const systemPrompt = `You are PantryPlate Chef, a creative, practical home-cooking chef who invents delicious, realistic recipes based on what is already in the user's pantry and fridge.

Rules:
- Generate exactly 3 distinct, genuinely tasty, realistic home-cooked recipes.
- ${
    params.strictMode
      ? "STRICT PANTRY MODE: Use ONLY ingredients from the user's pantry list plus basic tap water. Do NOT introduce any extra ingredients not listed."
      : "PANTRY-FIRST MODE: Base each recipe heavily on the user's pantry list. You may include at most 1–2 common extra ingredients if they dramatically elevate the dish, and keep at least 1 recipe 100% pantry-only."
  }
- Match ingredient names closely to the canonical names listed so pantry matching works accurately.
- Keep total time (prepMinutes + cookMinutes) at or under ${params.maxMinutes} minutes.
- Provide clean structured ingredients (quantity as decimal number or null, standard short unit like cup/tbsp/tsp/oz/lb/clove/can/each, clean ingredient name without prep words, concise notes).
- Write clear, easy-to-follow numbered cooking steps (without leading "1." prefixes), including the exact ingredient measurements right inside each step (e.g. "Toss 1 lb chicken with 1 tbsp olive oil and 1 tsp paprika") so the cook can follow along without flipping back.`;

  const userLines = [
    `Available Pantry & Fridge Inventory:\n${params.pantryLines.map((l) => `- ${l}`).join("\n")}`,
  ];
  if (params.priorityItems.length > 0) {
    userLines.push(`Must prioritize using up: ${params.priorityItems.join(", ")}`);
  }
  if (params.mealType && params.mealType !== "any") {
    userLines.push(`Meal type: ${params.mealType}`);
  }
  userLines.push(`Max total cook + prep time: ${params.maxMinutes} minutes`);
  if (params.craving.trim()) {
    userLines.push(`Preferences / craving / dietary notes: ${params.craving.trim()}`);
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
        json_schema: PANTRY_IDEAS_JSON_SCHEMA,
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userLines.join("\n\n") },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(
      JSON.stringify({
        message: "openai_pantry_generate_error",
        status: res.status,
        body: errText.slice(0, 400),
      })
    );
    throw new Error(`OpenAI recipe generation failed (${res.status})`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response");

  const parsed = JSON.parse(content) as { recipes: Omit<AiExtractedRaw, "sourceHandle">[] };
  const drafts: ParsedRecipeDraft[] = (parsed.recipes ?? []).slice(0, 3).map((raw) => {
    const ingredients = (raw.ingredients ?? [])
      .filter((i) => i.name && i.name.trim().length > 0)
      .map((i) => {
        const cleanName = i.name.trim();
        const unit = normalizeUnit(i.unit || "");
        return {
          rawText: `${i.quantity ?? ""} ${unit} ${cleanName}${i.notes ? `, ${i.notes}` : ""}`.trim(),
          quantity: typeof i.quantity === "number" && Number.isFinite(i.quantity) ? i.quantity : null,
          unit: unit || (i.quantity !== null ? "each" : ""),
          name: cleanName,
          canonicalName: canonicalizeIngredientName(cleanName),
          aisle: guessAisle(cleanName),
          notes: (i.notes || "").trim(),
        };
      });

    return {
      title: (raw.title || "Pantry Special").trim(),
      description: (raw.description || "").trim().slice(0, 400),
      sourceHandle: "PantryPlate Chef",
      servings: Math.max(1, Math.min(16, Math.round(raw.servings || 4))),
      prepMinutes: Math.max(0, Math.min(240, Math.round(raw.prepMinutes ?? 10))),
      cookMinutes: Math.max(0, Math.min(360, Math.round(raw.cookMinutes ?? 20))),
      tags: (raw.tags ?? [])
        .map((t) => t.replace(/^#/, "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5),
      ingredients,
      steps: (raw.steps ?? [])
        .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
        .filter(Boolean),
    };
  });

  return { drafts, model: data.model || AI_VISION_MODEL };
}
