import { Hono } from "hono";
import { z } from "zod";
import {
  canonicalizeIngredientName,
  guessAisle,
  guessStorageLocation,
  searchFoodReference,
} from "../../shared/foodDatabase";
import {
  classifyAdditiveTag,
  scoreOpenFoodFactsProduct,
} from "../../shared/nutritionScore";
import { normalizeUnit } from "../../shared/unitConverter";
import type { FoodNutriments, FoodProduct } from "../../shared/types";
import type { WorkerBindings } from "../lib/auth";
import {
  loadPriceOverrides,
  mapFoodCatalogRow,
  recalculateRecipeMetrics,
  type FoodCatalogRow,
} from "../lib/dbHelpers";

export const foodRoutes = new Hono<{ Bindings: WorkerBindings }>();

interface OffApiResponse {
  status: number;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    image_front_small_url?: string;
    image_front_url?: string;
    image_url?: string;
    quantity?: string;
    nutriscore_grade?: string;
    nutriscore_score?: number;
    nova_group?: number;
    additives_tags?: string[];
    labels_tags?: string[];
    categories_tags?: string[];
    nutriments?: Record<string, number | string | undefined>;
  };
}

function num(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

// Barcode lookup powered by Open Food Facts API v2 (same open food database Yuka uses) + D1 cache
foodRoutes.get("/barcode/:code", async (c) => {
  const rawCode = c.req.param("code");
  const barcode = rawCode.replace(/[^0-9]/g, "");
  if (barcode.length < 6 || barcode.length > 18) {
    return c.json({ error: "Invalid barcode format (expected 6–18 digits)" }, 400);
  }

  // 1. Check D1 cache first
  const cached = await c.env.DB.prepare("SELECT * FROM food_catalog WHERE barcode = ?")
    .bind(barcode)
    .first<FoodCatalogRow>();
  if (cached) {
    return c.json({ product: mapFoodCatalogRow(cached), source: "cache" });
  }

  // 2. Fetch live from Open Food Facts API v2
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_en,brands,image_front_small_url,image_front_url,image_url,quantity,nutriscore_grade,nutriscore_score,nova_group,additives_tags,labels_tags,categories_tags,nutriments`;

  let offData: OffApiResponse;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PantryPlate/1.0 (https://pantryplate.app)",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return c.json({ error: "Product not found in Open Food Facts" }, 404);
    }
    offData = (await res.json()) as OffApiResponse;
  } catch (err) {
    console.error(
      JSON.stringify({
        message: "openfoodfacts fetch failed",
        barcode,
        error: err instanceof Error ? err.message : String(err),
      })
    );
    return c.json({ error: "Unable to reach Open Food Facts right now" }, 502);
  }

  if (offData.status !== 1 || !offData.product) {
    return c.json({ error: "Product not found in Open Food Facts" }, 404);
  }

  const p = offData.product;
  const productName = (p.product_name_en || p.product_name || "Unknown Product").trim();
  const brand = (p.brands || "").split(",")[0]?.trim() || "";
  const imageUrl = p.image_front_small_url || p.image_front_url || p.image_url || "";
  const quantityText = p.quantity || "";
  const nutriscoreGrade = (p.nutriscore_grade || "").toLowerCase();
  const nutriscoreScore = num(p.nutriscore_score) ?? null;
  const novaGroup = num(p.nova_group) ?? null;

  const additives = (p.additives_tags ?? []).map(classifyAdditiveTag);
  const isOrganic = (p.labels_tags ?? []).some((t) => /organic|bio/i.test(t));

  const n = p.nutriments ?? {};
  const nutriments: FoodNutriments = {
    energyKcal100g: num(n["energy-kcal_100g"]) ?? num(n["energy-kcal"]),
    fat100g: num(n["fat_100g"]),
    saturatedFat100g: num(n["saturated-fat_100g"]),
    carbohydrates100g: num(n["carbohydrates_100g"]),
    sugars100g: num(n["sugars_100g"]),
    fiber100g: num(n["fiber_100g"]),
    proteins100g: num(n["proteins_100g"]),
    sodiumMg100g: num(n["sodium_100g"]) !== undefined ? num(n["sodium_100g"])! * 1000 : undefined,
    salt100g: num(n["salt_100g"]),
    fruitsVegetablesNuts100g:
      num(n["fruits-vegetables-nuts-estimate-from-ingredients_100g"]) ??
      num(n["fruits-vegetables-nuts_100g"]),
  };

  const scored = scoreOpenFoodFactsProduct({
    nutriscoreScore,
    nutriments,
    novaGroup,
    additives,
    isOrganic,
  });

  const canonicalGuess = canonicalizeIngredientName(productName);
  const suggestedAisle = guessAisle(productName);
  const suggestedLocation = guessStorageLocation(productName);

  const product: FoodProduct = {
    barcode,
    productName,
    brand,
    imageUrl,
    quantityText,
    nutriscoreGrade,
    nutriscoreScore,
    novaGroup,
    additives,
    isOrganic,
    nutriments,
    yukaScore: scored.score,
    yukaGrade: scored.grade,
    positives: scored.positives,
    negatives: scored.negatives,
    canonicalGuess,
    suggestedLocation,
    suggestedAisle,
  };

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO food_catalog (
       barcode, product_name, brand, image_url, quantity_text, nutriscore_grade, nutriscore_score,
       nova_group, additives_json, is_organic, nutriments_json, yuka_score, yuka_grade,
       yuka_summary_json, canonical_guess, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      barcode,
      productName,
      brand,
      imageUrl,
      quantityText,
      nutriscoreGrade,
      nutriscoreScore,
      novaGroup,
      JSON.stringify(additives),
      isOrganic ? 1 : 0,
      JSON.stringify(nutriments),
      scored.score,
      scored.grade,
      JSON.stringify({
        positives: scored.positives,
        negatives: scored.negatives,
        suggestedLocation,
        suggestedAisle,
      }),
      canonicalGuess
    )
    .run();

  return c.json({ product, source: "openfoodfacts" });
});

// Search built-in whole-food staples & cached scanned products
foodRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") || "").trim();
  const staples = searchFoodReference(q, 12).map((entry) => ({
    name: entry.canonicalName,
    canonicalName: entry.canonicalName,
    aisle: entry.aisle,
    defaultLocation: entry.defaultLocation,
    priceCents: entry.priceCents,
    priceUnit: entry.priceUnit,
    source: "staple" as const,
  }));

  let catalog: FoodProduct[] = [];
  if (q.length >= 2) {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM food_catalog
       WHERE LOWER(product_name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(canonical_guess) LIKE ?
       LIMIT 8`
    )
      .bind(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`)
      .all<FoodCatalogRow>();
    catalog = (results ?? []).map(mapFoodCatalogRow);
  }

  return c.json({ staples, catalog });
});

// Price overrides management
foodRoutes.get("/prices", async (c) => {
  const overrides = await loadPriceOverrides(c.env.DB);
  return c.json({ overrides: Object.values(overrides) });
});

const priceOverrideSchema = z.object({
  priceCents: z.number().int().min(1).max(100000),
  unit: z.string().min(1).max(32),
});

foodRoutes.put("/prices/:canonicalName", async (c) => {
  const canonicalName = decodeURIComponent(c.req.param("canonicalName")).trim().toLowerCase();
  const body = await c.req.json();
  const parsed = priceOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid price override" }, 400);
  }

  const unit = normalizeUnit(parsed.data.unit) || "each";
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO ingredient_price_overrides (canonical_name, price_cents, unit, source, updated_at)
     VALUES (?, ?, ?, 'user', datetime('now'))`
  )
    .bind(canonicalName, parsed.data.priceCents, unit)
    .run();

  await recalculateRecipeMetrics(c.env.DB, canonicalName);
  return c.json({
    canonicalName,
    priceCents: parsed.data.priceCents,
    unit,
  });
});

foodRoutes.delete("/prices/:canonicalName", async (c) => {
  const canonicalName = decodeURIComponent(c.req.param("canonicalName")).trim().toLowerCase();
  await c.env.DB.prepare("DELETE FROM ingredient_price_overrides WHERE canonical_name = ?")
    .bind(canonicalName)
    .run();
  await recalculateRecipeMetrics(c.env.DB, canonicalName);
  return c.json({ deleted: true });
});
