import { canonicalizeIngredientName, lookupFoodReference } from "./foodDatabase";
import { convertUnits, normalizeUnit } from "./unitConverter";
import type { IngredientInput, PantryItem, PriceOverride } from "./types";

export interface IngredientCostResult {
  canonicalName: string;
  costCents: number;
  source: "override" | "pantry" | "baseline" | "fallback";
}

export interface RecipeCostResult {
  totalCents: number;
  perServingCents: number;
  ingredientCosts: IngredientCostResult[];
}

export function estimateIngredientCostCents(
  ingredient: IngredientInput,
  priceOverrides: Record<string, PriceOverride> = {},
  pantryItems: PantryItem[] = []
): IngredientCostResult {
  const canonical = ingredient.canonicalName || canonicalizeIngredientName(ingredient.name);
  const qty = ingredient.quantity ?? 1;
  const unit = normalizeUnit(ingredient.unit) || "each";
  const foodRef = lookupFoodReference(canonical);

  // 1. Explicit user price override takes top precedence
  const override = priceOverrides[canonical];
  if (override) {
    const converted = convertUnits(qty, unit, override.unit, foodRef);
    const amount = converted !== null ? converted : qty;
    return {
      canonicalName: canonical,
      costCents: Math.max(5, Math.round(amount * override.priceCents)),
      source: "override",
    };
  }

  // 2. Pantry item recorded price if present
  const pantryMatch = pantryItems.find(
    (p) => p.canonicalName === canonical && p.unitPriceCents !== null && p.unitPriceCents > 0
  );
  if (pantryMatch && pantryMatch.unitPriceCents) {
    const pUnit = pantryMatch.priceUnit || pantryMatch.unit || "each";
    const converted = convertUnits(qty, unit, pUnit, foodRef);
    const amount = converted !== null ? converted : qty;
    return {
      canonicalName: canonical,
      costCents: Math.max(5, Math.round(amount * pantryMatch.unitPriceCents)),
      source: "pantry",
    };
  }

  // 3. Built-in US grocery baseline reference table
  if (foodRef) {
    const converted = convertUnits(qty, unit, foodRef.priceUnit, foodRef);
    const amount = converted !== null ? converted : qty;
    return {
      canonicalName: canonical,
      costCents: Math.max(5, Math.round(amount * foodRef.priceCents)),
      source: "baseline",
    };
  }

  // 4. Reasonable fallback for unrecognized ingredients based on unit
  let fallbackPerUnit = 125;
  if (unit === "tsp" || unit === "pinch") fallbackPerUnit = 15;
  else if (unit === "tbsp") fallbackPerUnit = 35;
  else if (unit === "clove") fallbackPerUnit = 12;
  else if (unit === "cup") fallbackPerUnit = 140;
  else if (unit === "oz") fallbackPerUnit = 40;
  else if (unit === "lb") fallbackPerUnit = 450;
  else if (unit === "can" || unit === "jar") fallbackPerUnit = 225;

  return {
    canonicalName: canonical,
    costCents: Math.max(10, Math.round(qty * fallbackPerUnit)),
    source: "fallback",
  };
}

export function calculateRecipeCost(
  ingredients: IngredientInput[],
  servings: number,
  priceOverrides: Record<string, PriceOverride> = {},
  pantryItems: PantryItem[] = []
): RecipeCostResult {
  const ingredientCosts = ingredients.map((ing) =>
    estimateIngredientCostCents(ing, priceOverrides, pantryItems)
  );
  const totalCents = ingredientCosts.reduce((sum, item) => sum + item.costCents, 0);
  const safeServings = Math.max(1, servings || 4);
  return {
    totalCents,
    perServingCents: Math.round(totalCents / safeServings),
    ingredientCosts,
  };
}

export function formatCents(cents: number): string {
  const dollars = Math.max(0, cents) / 100;
  return `$${dollars.toFixed(2)}`;
}
