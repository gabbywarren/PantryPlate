import { calculateRecipeCost } from "../../shared/costEstimator";
import { canonicalizeIngredientName, guessAisle } from "../../shared/foodDatabase";
import { calculateRecipeNutrition } from "../../shared/nutritionScore";
import type {
  FoodAdditiveInfo,
  FoodNutriments,
  FoodProduct,
  GroceryAisle,
  NutritionBreakdown,
  NutritionGrade,
  PantryItem,
  PriceOverride,
  RecipeIngredient,
  StockStatus,
  StorageLocation,
} from "../../shared/types";

export interface RecipeRow {
  id: string;
  title: string;
  description: string;
  source_url: string;
  source_handle: string;
  servings: number;
  prep_minutes: number;
  cook_minutes: number;
  cover_image_key: string | null;
  tags_json: string;
  nutrition_score: number;
  nutrition_grade: string;
  nutrition_breakdown_json: string;
  estimated_cost_cents: number;
  created_at: string;
  updated_at: string;
}

export interface IngredientRow {
  id: string;
  recipe_id: string;
  raw_text: string;
  quantity: number | null;
  unit: string;
  name: string;
  canonical_name: string;
  aisle: string;
  notes: string;
  food_barcode: string | null;
  estimated_cost_cents: number;
  sort_order: number;
}

export interface PantryRow {
  id: string;
  name: string;
  canonical_name: string;
  location: string;
  quantity: number | null;
  unit: string;
  stock_status: string;
  barcode: string | null;
  brand: string;
  image_url: string;
  unit_price_cents: number | null;
  price_unit: string;
  expires_at: string | null;
  updated_at: string;
}

export interface FoodCatalogRow {
  barcode: string;
  product_name: string;
  brand: string;
  image_url: string;
  quantity_text: string;
  nutriscore_grade: string;
  nutriscore_score: number | null;
  nova_group: number | null;
  additives_json: string;
  is_organic: number;
  nutriments_json: string;
  yuka_score: number;
  yuka_grade: string;
  yuka_summary_json: string;
  canonical_guess: string;
  fetched_at: string;
}

export function mapPantryRow(row: PantryRow): PantryItem {
  return {
    id: row.id,
    name: row.name,
    canonicalName: row.canonical_name,
    location: (row.location as StorageLocation) || "pantry",
    quantity: row.quantity,
    unit: row.unit,
    stockStatus: (row.stock_status as StockStatus) || "in_stock",
    barcode: row.barcode,
    brand: row.brand,
    imageUrl: row.image_url,
    unitPriceCents: row.unit_price_cents,
    priceUnit: row.price_unit,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  };
}

export function mapIngredientRow(row: IngredientRow): RecipeIngredient {
  return {
    id: row.id,
    rawText: row.raw_text,
    quantity: row.quantity,
    unit: row.unit,
    name: row.name,
    canonicalName: row.canonical_name,
    aisle: (row.aisle as GroceryAisle) || "Pantry & Grains",
    notes: row.notes,
    foodBarcode: row.food_barcode,
    estimatedCostCents: row.estimated_cost_cents,
    sortOrder: row.sort_order,
  };
}

export function mapFoodCatalogRow(row: FoodCatalogRow): FoodProduct {
  let additives: FoodAdditiveInfo[] = [];
  let nutriments: FoodNutriments = {};
  let summary: { positives?: string[]; negatives?: string[]; suggestedLocation?: StorageLocation; suggestedAisle?: GroceryAisle } = {};
  try {
    additives = JSON.parse(row.additives_json);
  } catch { /* ignore */ }
  try {
    nutriments = JSON.parse(row.nutriments_json);
  } catch { /* ignore */ }
  try {
    summary = JSON.parse(row.yuka_summary_json);
  } catch { /* ignore */ }

  return {
    barcode: row.barcode,
    productName: row.product_name,
    brand: row.brand,
    imageUrl: row.image_url,
    quantityText: row.quantity_text,
    nutriscoreGrade: row.nutriscore_grade,
    nutriscoreScore: row.nutriscore_score,
    novaGroup: row.nova_group,
    additives,
    isOrganic: Boolean(row.is_organic),
    nutriments,
    yukaScore: row.yuka_score,
    yukaGrade: (row.yuka_grade as NutritionGrade) || "good",
    positives: summary.positives ?? [],
    negatives: summary.negatives ?? [],
    canonicalGuess: row.canonical_guess || canonicalizeIngredientName(row.product_name),
    suggestedLocation: summary.suggestedLocation ?? "pantry",
    suggestedAisle: summary.suggestedAisle ?? guessAisle(row.product_name),
  };
}

export async function loadAllPantryItems(db: D1Database): Promise<PantryItem[]> {
  const { results } = await db
    .prepare("SELECT * FROM pantry_items ORDER BY location ASC, name ASC")
    .all<PantryRow>();
  return (results ?? []).map(mapPantryRow);
}

export async function loadPriceOverrides(db: D1Database): Promise<Record<string, PriceOverride>> {
  const { results } = await db
    .prepare("SELECT canonical_name, price_cents, unit, source, updated_at FROM ingredient_price_overrides")
    .all<{
      canonical_name: string;
      price_cents: number;
      unit: string;
      source: string;
      updated_at: string;
    }>();

  const map: Record<string, PriceOverride> = {};
  for (const r of results ?? []) {
    map[r.canonical_name] = {
      canonicalName: r.canonical_name,
      priceCents: r.price_cents,
      unit: r.unit,
      source: r.source,
      updatedAt: r.updated_at,
    };
  }
  return map;
}

export async function loadFoodProductsByBarcodes(
  db: D1Database,
  barcodes: string[]
): Promise<Record<string, FoodProduct>> {
  const unique = Array.from(new Set(barcodes.filter(Boolean)));
  if (unique.length === 0) return {};

  const placeholders = unique.map(() => "?").join(", ");
  const { results } = await db
    .prepare(`SELECT * FROM food_catalog WHERE barcode IN (${placeholders})`)
    .bind(...unique)
    .all<FoodCatalogRow>();

  const map: Record<string, FoodProduct> = {};
  for (const row of results ?? []) {
    map[row.barcode] = mapFoodCatalogRow(row);
  }
  return map;
}

/**
 * Recalculates estimated costs and nutrition for all recipes that reference a given canonical ingredient
 * (or all recipes if canonicalName is omitted).
 */
export async function recalculateRecipeMetrics(db: D1Database, canonicalName?: string): Promise<void> {
  const pantryItems = await loadAllPantryItems(db);
  const priceOverrides = await loadPriceOverrides(db);

  let recipeIds: string[];
  if (canonicalName) {
    const { results } = await db
      .prepare("SELECT DISTINCT recipe_id FROM recipe_ingredients WHERE canonical_name = ?")
      .bind(canonicalName)
      .all<{ recipe_id: string }>();
    recipeIds = (results ?? []).map((r) => r.recipe_id);
  } else {
    const { results } = await db.prepare("SELECT id FROM recipes").all<{ id: string }>();
    recipeIds = (results ?? []).map((r) => r.id);
  }

  for (const recipeId of recipeIds) {
    const recipe = await db
      .prepare("SELECT servings FROM recipes WHERE id = ?")
      .bind(recipeId)
      .first<{ servings: number }>();
    if (!recipe) continue;

    const { results: ingRows } = await db
      .prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC")
      .bind(recipeId)
      .all<IngredientRow>();

    const ingredients = (ingRows ?? []).map(mapIngredientRow);
    const barcodes = ingredients.map((i) => i.foodBarcode).filter((b): b is string => Boolean(b));
    const linkedProducts = await loadFoodProductsByBarcodes(db, barcodes);

    const costResult = calculateRecipeCost(ingredients, recipe.servings, priceOverrides, pantryItems);
    const nutrition: NutritionBreakdown = calculateRecipeNutrition(
      ingredients,
      recipe.servings,
      linkedProducts
    );

    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE recipes
           SET nutrition_score = ?, nutrition_grade = ?, nutrition_breakdown_json = ?,
               estimated_cost_cents = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          nutrition.score,
          nutrition.grade,
          JSON.stringify(nutrition),
          costResult.totalCents,
          recipeId
        ),
    ];

    for (let idx = 0; idx < ingredients.length; idx++) {
      statements.push(
        db
          .prepare("UPDATE recipe_ingredients SET estimated_cost_cents = ? WHERE id = ?")
          .bind(costResult.ingredientCosts[idx].costCents, ingredients[idx].id)
      );
    }

    await db.batch(statements);
  }
}

export function imageUrlFromKey(key: string | null): string | null {
  if (!key) return null;
  return `/images/${encodeURIComponent(key)}`;
}
