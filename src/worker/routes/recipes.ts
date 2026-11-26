import { Hono } from "hono";
import { z } from "zod";
import { calculateRecipeCost } from "../../shared/costEstimator";
import { canonicalizeIngredientName, guessAisle } from "../../shared/foodDatabase";
import { calculateRecipeNutrition } from "../../shared/nutritionScore";
import { evaluateRecipePantryMatch } from "../../shared/pantryMatcher";
import { normalizeUnit } from "../../shared/unitConverter";
import type {
  GroceryAisle,
  NutritionBreakdown,
  NutritionGrade,
  RecipeDetail,
  RecipeScreenshot,
  RecipeStep,
  RecipeSummary,
} from "../../shared/types";
import type { WorkerBindings } from "../lib/auth";
import {
  imageUrlFromKey,
  loadAllPantryItems,
  loadFoodProductsByBarcodes,
  loadPriceOverrides,
  mapIngredientRow,
  type IngredientRow,
  type RecipeRow,
} from "../lib/dbHelpers";
import { deleteImagesFromDb, saveImageToDb } from "../lib/imageStore";
import { AI_VISION_MODEL, extractRecipeWithLuna } from "../lib/aiExtract";

const ingredientSchema = z.object({
  rawText: z.string().optional().default(""),
  quantity: z.number().nullable().optional().default(null),
  unit: z.string().optional().default(""),
  name: z.string().min(1),
  canonicalName: z.string().optional(),
  aisle: z.string().optional(),
  notes: z.string().optional().default(""),
  foodBarcode: z.string().nullable().optional().default(null),
});

const screenshotSchema = z.object({
  imageKey: z.string().min(1),
  ocrText: z.string().optional().default(""),
});

const recipeUpsertSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(600).optional().default(""),
  sourceUrl: z.string().max(500).optional().default(""),
  sourceHandle: z.string().max(80).optional().default(""),
  servings: z.number().int().min(1).max(32).optional().default(4),
  prepMinutes: z.number().int().min(0).max(600).optional().default(10),
  cookMinutes: z.number().int().min(0).max(1440).optional().default(20),
  coverImageKey: z.string().nullable().optional().default(null),
  tags: z.array(z.string().max(32)).max(12).optional().default([]),
  ingredients: z.array(ingredientSchema).default([]),
  steps: z.array(z.string().min(1)).default([]),
  screenshots: z.array(screenshotSchema).optional().default([]),
  inboxId: z.string().optional(),
});

export const recipesRoutes = new Hono<{ Bindings: WorkerBindings }>();

// Check if GPT-6 Luna AI Vision is enabled
recipesRoutes.get("/ai-status", (c) => {
  return c.json({
    aiEnabled: Boolean(c.env.OPENAI_API_KEY),
    model: AI_VISION_MODEL,
  });
});

const extractAiSchema = z.object({
  imageKeys: z.array(z.string().min(1)).max(6).optional().default([]),
  rawText: z.string().max(15000).optional().default(""),
});

// Extract structured recipe directly from uploaded screenshots &/or pasted caption via GPT-6 Luna Vision
recipesRoutes.post("/extract-ai", async (c) => {
  const apiKey = c.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: "OpenAI API key not configured", fallbackToLocalOcr: true },
      503
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = extractAiSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid extraction payload" }, 400);
  }

  const { imageKeys, rawText } = parsed.data;
  if (imageKeys.length === 0 && !rawText.trim()) {
    return c.json({ error: "Provide at least one screenshot or recipe text" }, 400);
  }

  const images: { contentType: string; dataBase64: string }[] = [];
  for (const key of imageKeys) {
    const row = await c.env.DB.prepare(
      "SELECT content_type, data_base64 FROM stored_images WHERE key = ?"
    )
      .bind(key)
      .first<{ content_type: string; data_base64: string }>();
    if (row) {
      images.push({
        contentType: row.content_type || "image/jpeg",
        dataBase64: row.data_base64,
      });
    }
  }

  if (imageKeys.length > 0 && images.length === 0 && !rawText.trim()) {
    return c.json({ error: "Uploaded screenshot(s) could not be found" }, 404);
  }

  try {
    const result = await extractRecipeWithLuna({
      apiKey,
      images,
      rawText,
    });
    return c.json(result);
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "extract_ai_failed",
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return c.json(
      {
        error: err instanceof Error ? err.message : "AI extraction failed",
        fallbackToLocalOcr: true,
      },
      502
    );
  }
});

// Upload compressed screenshot or cover photo to D1 stored_images
recipesRoutes.post("/upload-image", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") || "screenshot");

  if (!(file instanceof File)) {
    return c.json({ error: "Missing image file" }, 400);
  }
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return c.json({ error: "Only image uploads are supported" }, 400);
  }

  const ext = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const prefix = kind === "cover" ? "covers" : "screenshots";
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;

  try {
    await saveImageToDb(c.env.DB, key, await file.arrayBuffer(), contentType);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to store image" },
      413
    );
  }

  return c.json({
    imageKey: key,
    imageUrl: imageUrlFromKey(key),
  });
});

// List all recipes with live pantry match stats
recipesRoutes.get("/", async (c) => {
  const q = (c.req.query("q") || "").trim().toLowerCase();
  const sort = c.req.query("sort") || "recent";
  const filter = c.req.query("filter") || "all";

  const [{ results: recipeRows }, { results: allIngRows }, pantryItems] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM recipes ORDER BY created_at DESC").all<RecipeRow>(),
    c.env.DB.prepare("SELECT * FROM recipe_ingredients ORDER BY sort_order ASC").all<IngredientRow>(),
    loadAllPantryItems(c.env.DB),
  ]);

  const ingsByRecipe = new Map<string, ReturnType<typeof mapIngredientRow>[]>();
  for (const row of allIngRows ?? []) {
    const list = ingsByRecipe.get(row.recipe_id) ?? [];
    list.push(mapIngredientRow(row));
    ingsByRecipe.set(row.recipe_id, list);
  }

  let summaries: RecipeSummary[] = (recipeRows ?? []).map((row) => {
    const ingredients = ingsByRecipe.get(row.id) ?? [];
    const { summary: pantrySummary } = evaluateRecipePantryMatch(ingredients, pantryItems);
    let tags: string[] = [];
    try {
      tags = JSON.parse(row.tags_json);
    } catch { /* ignore */ }

    const servings = Math.max(1, row.servings);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      sourceUrl: row.source_url,
      sourceHandle: row.source_handle,
      servings,
      prepMinutes: row.prep_minutes,
      cookMinutes: row.cook_minutes,
      coverImageKey: row.cover_image_key,
      coverImageUrl: imageUrlFromKey(row.cover_image_key),
      tags,
      nutritionScore: row.nutrition_score,
      nutritionGrade: (row.nutrition_grade as NutritionGrade) || "good",
      estimatedCostCents: row.estimated_cost_cents,
      costPerServingCents: Math.round(row.estimated_cost_cents / servings),
      pantrySummary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  if (q) {
    summaries = summaries.filter((r) => {
      const ings = ingsByRecipe.get(r.id) ?? [];
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.sourceHandle.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        ings.some((i) => i.name.toLowerCase().includes(q) || i.canonicalName.toLowerCase().includes(q))
      );
    });
  }

  if (filter === "can_cook") {
    summaries = summaries.filter((r) => r.pantrySummary.readyPct >= 75);
  } else if (filter === "healthy") {
    summaries = summaries.filter((r) => r.nutritionScore >= 75);
  } else if (filter === "budget") {
    summaries = summaries.filter((r) => r.estimatedCostCents <= 1200);
  }

  if (sort === "nutrition") {
    summaries.sort((a, b) => b.nutritionScore - a.nutritionScore);
  } else if (sort === "cost") {
    summaries.sort((a, b) => a.estimatedCostCents - b.estimatedCostCents);
  } else if (sort === "pantry_match") {
    summaries.sort((a, b) => b.pantrySummary.readyPct - a.pantrySummary.readyPct);
  }

  return c.json({ recipes: summaries });
});

// Get full recipe detail with live pantry match per ingredient
recipesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const recipe = await c.env.DB.prepare("SELECT * FROM recipes WHERE id = ?")
    .bind(id)
    .first<RecipeRow>();

  if (!recipe) {
    return c.json({ error: "Recipe not found" }, 404);
  }

  const [{ results: ingRows }, { results: stepRows }, { results: ssRows }, pantryItems] =
    await Promise.all([
      c.env.DB.prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC")
        .bind(id)
        .all<IngredientRow>(),
      c.env.DB.prepare("SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number ASC")
        .bind(id)
        .all<{ id: string; step_number: number; instruction: string }>(),
      c.env.DB.prepare("SELECT * FROM recipe_screenshots WHERE recipe_id = ? ORDER BY sort_order ASC")
        .bind(id)
        .all<{ id: string; image_key: string; ocr_text: string; sort_order: number }>(),
      loadAllPantryItems(c.env.DB),
    ]);

  const mappedIngredients = (ingRows ?? []).map(mapIngredientRow);
  const { matches, summary: pantrySummary } = evaluateRecipePantryMatch(
    mappedIngredients,
    pantryItems
  );

  let tags: string[] = [];
  let nutritionBreakdown: NutritionBreakdown = {
    score: recipe.nutrition_score,
    grade: (recipe.nutrition_grade as NutritionGrade) || "good",
    nutritionPoints: 40,
    additivesPoints: 26,
    wholeFoodPoints: 7,
    perServing: {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      saturatedFatG: 0,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
    },
    positives: [],
    negatives: [],
    contributors: [],
    coveragePct: 0,
  };
  try {
    tags = JSON.parse(recipe.tags_json);
  } catch { /* ignore */ }
  try {
    const parsed = JSON.parse(recipe.nutrition_breakdown_json);
    if (parsed && typeof parsed.score === "number") {
      nutritionBreakdown = parsed;
    }
  } catch { /* ignore */ }

  const steps: RecipeStep[] = (stepRows ?? []).map((s) => ({
    id: s.id,
    stepNumber: s.step_number,
    instruction: s.instruction,
  }));

  const screenshots: RecipeScreenshot[] = (ssRows ?? []).map((s) => ({
    id: s.id,
    imageKey: s.image_key,
    imageUrl: imageUrlFromKey(s.image_key) ?? "",
    ocrText: s.ocr_text,
    sortOrder: s.sort_order,
  }));

  const servings = Math.max(1, recipe.servings);
  const detail: RecipeDetail = {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    sourceUrl: recipe.source_url,
    sourceHandle: recipe.source_handle,
    servings,
    prepMinutes: recipe.prep_minutes,
    cookMinutes: recipe.cook_minutes,
    coverImageKey: recipe.cover_image_key,
    coverImageUrl: imageUrlFromKey(recipe.cover_image_key),
    tags,
    nutritionScore: recipe.nutrition_score,
    nutritionGrade: (recipe.nutrition_grade as NutritionGrade) || "good",
    nutritionBreakdown,
    estimatedCostCents: recipe.estimated_cost_cents,
    costPerServingCents: Math.round(recipe.estimated_cost_cents / servings),
    pantrySummary,
    ingredients: mappedIngredients.map((ing) => ({
      ...ing,
      pantryMatch: matches.get(ing.id)!,
    })),
    steps,
    screenshots,
    createdAt: recipe.created_at,
    updatedAt: recipe.updated_at,
  };

  return c.json({ recipe: detail });
});

async function saveRecipe(
  db: D1Database,
  recipeId: string,
  payload: z.infer<typeof recipeUpsertSchema>,
  isUpdate: boolean
) {
  const [pantryItems, priceOverrides] = await Promise.all([
    loadAllPantryItems(db),
    loadPriceOverrides(db),
  ]);

  const normalizedIngredients = payload.ingredients.map((ing) => {
    const canonicalName = ing.canonicalName?.trim() || canonicalizeIngredientName(ing.name);
    const aisle = (ing.aisle?.trim() as GroceryAisle) || guessAisle(ing.name);
    return {
      ...ing,
      unit: normalizeUnit(ing.unit),
      canonicalName,
      aisle,
    };
  });

  const barcodes = normalizedIngredients
    .map((i) => i.foodBarcode)
    .filter((b): b is string => Boolean(b));
  const linkedProducts = await loadFoodProductsByBarcodes(db, barcodes);

  const costResult = calculateRecipeCost(
    normalizedIngredients,
    payload.servings,
    priceOverrides,
    pantryItems
  );
  const nutrition = calculateRecipeNutrition(
    normalizedIngredients,
    payload.servings,
    linkedProducts
  );

  const statements: D1PreparedStatement[] = [];

  if (isUpdate) {
    statements.push(
      db
        .prepare(
          `UPDATE recipes
           SET title = ?, description = ?, source_url = ?, source_handle = ?,
               servings = ?, prep_minutes = ?, cook_minutes = ?, cover_image_key = ?,
               tags_json = ?, nutrition_score = ?, nutrition_grade = ?,
               nutrition_breakdown_json = ?, estimated_cost_cents = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          payload.title.trim(),
          payload.description.trim(),
          payload.sourceUrl.trim(),
          payload.sourceHandle.trim(),
          payload.servings,
          payload.prepMinutes,
          payload.cookMinutes,
          payload.coverImageKey,
          JSON.stringify(payload.tags),
          nutrition.score,
          nutrition.grade,
          JSON.stringify(nutrition),
          costResult.totalCents,
          recipeId
        ),
      db.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").bind(recipeId),
      db.prepare("DELETE FROM recipe_steps WHERE recipe_id = ?").bind(recipeId)
    );
    if (payload.screenshots.length > 0) {
      statements.push(
        db.prepare("DELETE FROM recipe_screenshots WHERE recipe_id = ?").bind(recipeId)
      );
    }
  } else {
    statements.push(
      db
        .prepare(
          `INSERT INTO recipes (
             id, title, description, source_url, source_handle, servings, prep_minutes, cook_minutes,
             cover_image_key, tags_json, nutrition_score, nutrition_grade, nutrition_breakdown_json,
             estimated_cost_cents
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          recipeId,
          payload.title.trim(),
          payload.description.trim(),
          payload.sourceUrl.trim(),
          payload.sourceHandle.trim(),
          payload.servings,
          payload.prepMinutes,
          payload.cookMinutes,
          payload.coverImageKey,
          JSON.stringify(payload.tags),
          nutrition.score,
          nutrition.grade,
          JSON.stringify(nutrition),
          costResult.totalCents
        )
    );
  }

  normalizedIngredients.forEach((ing, idx) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO recipe_ingredients (
             id, recipe_id, raw_text, quantity, unit, name, canonical_name, aisle, notes,
             food_barcode, estimated_cost_cents, sort_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          recipeId,
          ing.rawText || `${ing.quantity ?? ""} ${ing.unit} ${ing.name}`.trim(),
          ing.quantity,
          ing.unit,
          ing.name.trim(),
          ing.canonicalName,
          ing.aisle,
          ing.notes,
          ing.foodBarcode,
          costResult.ingredientCosts[idx].costCents,
          idx
        )
    );
  });

  payload.steps.forEach((instruction, idx) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO recipe_steps (id, recipe_id, step_number, instruction)
           VALUES (?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), recipeId, idx + 1, instruction.trim())
    );
  });

  payload.screenshots.forEach((ss, idx) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO recipe_screenshots (id, recipe_id, image_key, ocr_text, sort_order)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), recipeId, ss.imageKey, ss.ocrText, idx)
    );
  });

  if (payload.inboxId) {
    statements.push(
      db
        .prepare("UPDATE screenshot_inbox SET status = 'imported' WHERE id = ?")
        .bind(payload.inboxId)
    );
  }

  await db.batch(statements);
  return { id: recipeId, nutritionScore: nutrition.score, estimatedCostCents: costResult.totalCents };
}

recipesRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = recipeUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid recipe payload", details: parsed.error.flatten() }, 400);
  }

  const id = crypto.randomUUID();
  const saved = await saveRecipe(c.env.DB, id, parsed.data, false);
  return c.json(saved, 201);
});

recipesRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id FROM recipes WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) {
    return c.json({ error: "Recipe not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = recipeUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid recipe payload", details: parsed.error.flatten() }, 400);
  }

  const saved = await saveRecipe(c.env.DB, id, parsed.data, true);
  return c.json(saved);
});

recipesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const recipe = await c.env.DB.prepare("SELECT cover_image_key FROM recipes WHERE id = ?")
    .bind(id)
    .first<{ cover_image_key: string | null }>();
  if (!recipe) {
    return c.json({ error: "Recipe not found" }, 404);
  }

  const { results: ssRows } = await c.env.DB.prepare(
    "SELECT image_key FROM recipe_screenshots WHERE recipe_id = ?"
  )
    .bind(id)
    .all<{ image_key: string }>();

  await c.env.DB.prepare("DELETE FROM recipes WHERE id = ?").bind(id).run();

  const keysToDelete: string[] = [];
  if (recipe.cover_image_key) keysToDelete.push(recipe.cover_image_key);
  for (const s of ssRows ?? []) {
    if (s.image_key) keysToDelete.push(s.image_key);
  }
  if (keysToDelete.length > 0) {
    c.executionCtx.waitUntil(deleteImagesFromDb(c.env.DB, keysToDelete));
  }

  return c.json({ deleted: true });
});

// Seed 3 curated sample recipes + starter pantry staples for instant onboarding
recipesRoutes.post("/seed-samples", async (c) => {
  const starterPantry = [
    { name: "Extra Virgin Olive Oil", canonical: "olive oil", location: "spices", quantity: 1, unit: "bottle" },
    { name: "Kosher Salt", canonical: "salt", location: "spices", quantity: 1, unit: "box" },
    { name: "Black Pepper", canonical: "black pepper", location: "spices", quantity: 1, unit: "jar" },
    { name: "Garlic", canonical: "garlic", location: "pantry", quantity: 8, unit: "clove" },
    { name: "Yellow Onion", canonical: "yellow onion", location: "pantry", quantity: 2, unit: "each" },
    { name: "Rigatoni Pasta", canonical: "pasta", location: "pantry", quantity: 1, unit: "lb" },
    { name: "Eggs", canonical: "eggs", location: "fridge", quantity: 6, unit: "each" },
  ];

  for (const item of starterPantry) {
    const exists = await c.env.DB.prepare(
      "SELECT id FROM pantry_items WHERE canonical_name = ?"
    )
      .bind(item.canonical)
      .first();
    if (!exists) {
      await c.env.DB.prepare(
        `INSERT INTO pantry_items (id, name, canonical_name, location, quantity, unit, stock_status)
         VALUES (?, ?, ?, ?, ?, ?, 'in_stock')`
      )
        .bind(
          crypto.randomUUID(),
          item.name,
          item.canonical,
          item.location,
          item.quantity,
          item.unit
        )
        .run();
    }
  }

  const samples: z.input<typeof recipeUpsertSchema>[] = [
    {
      title: "Lemon Herb Salmon & Quinoa Bowl",
      description: "Crispy pan-seared salmon over fluffy quinoa with charred broccoli, avocado, and a bright lemon-garlic drizzle.",
      sourceUrl: "",
      sourceHandle: "@weeknightgreens",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 20,
      coverImageKey: null,
      tags: ["high-protein", "healthy", "30-min"],
      ingredients: [
        { rawText: "1.5 lb salmon fillets", quantity: 1.5, unit: "lb", name: "salmon fillets", notes: "skin-on" },
        { rawText: "1 cup quinoa", quantity: 1, unit: "cup", name: "quinoa", notes: "rinsed" },
        { rawText: "1 head broccoli", quantity: 1, unit: "head", name: "broccoli", notes: "cut into florets" },
        { rawText: "1 avocado", quantity: 1, unit: "each", name: "avocado", notes: "sliced" },
        { rawText: "2 tbsp olive oil", quantity: 2, unit: "tbsp", name: "olive oil", notes: "" },
        { rawText: "3 cloves garlic", quantity: 3, unit: "clove", name: "garlic", notes: "minced" },
        { rawText: "1 lemon", quantity: 1, unit: "each", name: "lemon", notes: "juiced & zested" },
        { rawText: "1/2 tsp kosher salt", quantity: 0.5, unit: "tsp", name: "kosher salt", notes: "" },
      ],
      steps: [
        "Rinse quinoa and simmer with 2 cups water and a pinch of salt for 15 minutes until fluffy.",
        "Toss broccoli florets with 1 tbsp olive oil, half the minced garlic, and salt. Roast at 425°F for 15 minutes until crisp at the edges.",
        "Pat salmon dry and season with salt, pepper, and lemon zest. Sear skin-side down in 1 tbsp olive oil over medium-high heat for 4–5 minutes, then flip for 2–3 minutes.",
        "Divide quinoa, roasted broccoli, salmon, and sliced avocado into bowls. Drizzle with fresh lemon juice and remaining garlic oil.",
      ],
      screenshots: [],
    },
    {
      title: "20-Minute Tuscan Chickpea & Spinach Pasta",
      description: "A budget-friendly one-pot Mediterranean pasta packed with plant protein, baby spinach, and fire-roasted tomatoes.",
      sourceUrl: "",
      sourceHandle: "@pantrychef",
      servings: 4,
      prepMinutes: 5,
      cookMinutes: 15,
      coverImageKey: null,
      tags: ["budget", "vegetarian", "one-pot"],
      ingredients: [
        { rawText: "12 oz rigatoni pasta", quantity: 12, unit: "oz", name: "rigatoni pasta", notes: "" },
        { rawText: "1 can chickpeas", quantity: 1, unit: "can", name: "chickpeas", notes: "drained and rinsed" },
        { rawText: "1 can diced tomatoes", quantity: 1, unit: "can", name: "diced tomatoes", notes: "fire-roasted" },
        { rawText: "4 cups baby spinach", quantity: 4, unit: "cup", name: "baby spinach", notes: "" },
        { rawText: "1 yellow onion", quantity: 1, unit: "each", name: "yellow onion", notes: "finely diced" },
        { rawText: "4 cloves garlic", quantity: 4, unit: "clove", name: "garlic", notes: "minced" },
        { rawText: "2 tbsp olive oil", quantity: 2, unit: "tbsp", name: "olive oil", notes: "" },
        { rawText: "1/3 cup grated parmesan", quantity: 0.33, unit: "cup", name: "parmesan cheese", notes: "plus more for serving" },
        { rawText: "1 tsp italian seasoning", quantity: 1, unit: "tsp", name: "italian seasoning", notes: "" },
      ],
      steps: [
        "Boil salted water and cook rigatoni until al dente; reserve 1/2 cup pasta water before draining.",
        "Sauté diced onion in olive oil for 4 minutes until translucent, then stir in garlic and Italian seasoning for 1 minute.",
        "Pour in diced tomatoes and chickpeas; simmer 5 minutes until thickened.",
        "Fold in baby spinach until wilted, then toss with cooked pasta, splashes of pasta water, and grated parmesan.",
      ],
      screenshots: [],
    },
    {
      title: "Crispy Bacon & Cheddar Skillet Breakfast Hash",
      description: "Hearty weekend brunch skillet with golden potatoes, thick-cut bacon, melted cheddar, and runny fried eggs.",
      sourceUrl: "",
      sourceHandle: "@sundaybrunchclub",
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 25,
      coverImageKey: null,
      tags: ["breakfast", "comfort", "skillet"],
      ingredients: [
        { rawText: "1.5 lb Yukon gold potatoes", quantity: 1.5, unit: "lb", name: "Yukon gold potatoes", notes: "cubed" },
        { rawText: "8 slices bacon", quantity: 8, unit: "slice", name: "bacon", notes: "chopped" },
        { rawText: "1 cup shredded cheddar", quantity: 1, unit: "cup", name: "cheddar cheese", notes: "" },
        { rawText: "4 large eggs", quantity: 4, unit: "each", name: "eggs", notes: "" },
        { rawText: "1 red bell pepper", quantity: 1, unit: "each", name: "red bell pepper", notes: "diced" },
        { rawText: "1 yellow onion", quantity: 1, unit: "each", name: "yellow onion", notes: "diced" },
        { rawText: "2 tbsp butter", quantity: 2, unit: "tbsp", name: "butter", notes: "" },
        { rawText: "1 tsp smoked paprika", quantity: 1, unit: "tsp", name: "smoked paprika", notes: "" },
      ],
      steps: [
        "Crisp chopped bacon in a large cast-iron skillet over medium heat; transfer bacon to a plate, leaving 1 tbsp drippings.",
        "Add butter, cubed potatoes, onion, bell pepper, and smoked paprika. Cook undisturbed in intervals for 15 minutes until deeply golden.",
        "Stir bacon back into the skillet, scatter cheddar across the top, and make 4 wells for the eggs.",
        "Crack eggs into the wells, cover skillet for 4–5 minutes until whites are set, and serve hot.",
      ],
      screenshots: [],
    },
  ];

  const createdIds: string[] = [];
  for (const sample of samples) {
    const existing = await c.env.DB.prepare("SELECT id FROM recipes WHERE title = ?")
      .bind(sample.title)
      .first();
    if (!existing) {
      const saved = await saveRecipe(
        c.env.DB,
        crypto.randomUUID(),
        recipeUpsertSchema.parse(sample),
        false
      );
      createdIds.push(saved.id);
    }
  }

  return c.json({ seededRecipes: createdIds.length, starterPantryAdded: true });
});
