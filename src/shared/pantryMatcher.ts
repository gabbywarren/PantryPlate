import { canonicalizeIngredientName, lookupFoodReference } from "./foodDatabase";
import { convertUnits, formatQuantity, normalizeUnit } from "./unitConverter";
import type {
  IngredientPantryMatch,
  PantryItem,
  RecipeIngredient,
  RecipePantrySummary,
} from "./types";

function findMatchingPantryItem(
  canonicalName: string,
  rawName: string,
  pantryItems: PantryItem[]
): PantryItem | undefined {
  const active = pantryItems.filter((p) => p.stockStatus !== "out");
  const target = canonicalName.toLowerCase().trim();

  // 1. Exact canonical match
  const exact = active.find((p) => p.canonicalName.toLowerCase() === target);
  if (exact) return exact;

  // 2. Match via canonicalized rawName
  const altCanonical = canonicalizeIngredientName(rawName);
  const alt = active.find((p) => p.canonicalName.toLowerCase() === altCanonical);
  if (alt) return alt;

  // 3. Token overlap fallback for custom/unmapped items (e.g. "whole wheat pasta" vs "pasta")
  const targetTokens = new Set(target.split(/\s+/).filter((t) => t.length > 2));
  if (targetTokens.size === 0) return undefined;

  for (const item of active) {
    const pCanon = item.canonicalName.toLowerCase();
    if (target.includes(pCanon) || pCanon.includes(target)) {
      return item;
    }
  }

  return undefined;
}

export function matchIngredientToPantry(
  ingredient: RecipeIngredient,
  pantryItems: PantryItem[]
): IngredientPantryMatch {
  const match = findMatchingPantryItem(ingredient.canonicalName, ingredient.name, pantryItems);
  if (!match) {
    return {
      ingredientId: ingredient.id,
      status: "missing",
      missingQuantity: ingredient.quantity,
      missingUnit: ingredient.unit,
      note: "Need to buy",
    };
  }

  // If marked "running low", flag it so the user knows to verify/restock
  if (match.stockStatus === "low") {
    return {
      ingredientId: ingredient.id,
      status: "low_stock",
      pantryItemId: match.id,
      pantryItemName: match.name,
      pantryLocation: match.location,
      pantryQuantity: match.quantity,
      pantryUnit: match.unit,
      missingQuantity: ingredient.quantity,
      missingUnit: ingredient.unit,
      note: `Running low in ${match.location}`,
    };
  }

  // If user didn't enter a numeric quantity in pantry (just "In Stock") or recipe has no qty, assume sufficient
  if (match.quantity === null || ingredient.quantity === null) {
    return {
      ingredientId: ingredient.id,
      status: "have_enough",
      pantryItemId: match.id,
      pantryItemName: match.name,
      pantryLocation: match.location,
      pantryQuantity: match.quantity,
      pantryUnit: match.unit,
      missingQuantity: 0,
      missingUnit: ingredient.unit,
      note: `In ${match.location}`,
    };
  }

  // Unit-aware comparison
  const foodRef = lookupFoodReference(ingredient.canonicalName);
  const reqUnit = normalizeUnit(ingredient.unit) || "each";
  const haveUnit = normalizeUnit(match.unit) || "each";

  // Pantry containers like "bottle", "jar", "bag", "box" generally cover small spoon/pinch recipe amounts
  const bulkContainers = new Set(["bottle", "jar", "bag", "box", "carton", "bunch", "head"]);
  const smallUnits = new Set(["tsp", "tbsp", "pinch", "clove", "sprig"]);
  if (bulkContainers.has(haveUnit) && smallUnits.has(reqUnit)) {
    return {
      ingredientId: ingredient.id,
      status: "have_enough",
      pantryItemId: match.id,
      pantryItemName: match.name,
      pantryLocation: match.location,
      pantryQuantity: match.quantity,
      pantryUnit: match.unit,
      missingQuantity: 0,
      missingUnit: ingredient.unit,
      note: `In ${match.location} (${formatQuantity(match.quantity)} ${match.unit})`,
    };
  }

  const convertedHave = convertUnits(match.quantity, haveUnit, reqUnit, foodRef);
  if (convertedHave === null) {
    // Incompatible units (e.g. pantry says "1 bottle", recipe says "1 cup") — treat as have_enough with note
    return {
      ingredientId: ingredient.id,
      status: "have_enough",
      pantryItemId: match.id,
      pantryItemName: match.name,
      pantryLocation: match.location,
      pantryQuantity: match.quantity,
      pantryUnit: match.unit,
      missingQuantity: 0,
      missingUnit: ingredient.unit,
      note: `In ${match.location} (${formatQuantity(match.quantity)} ${match.unit})`,
    };
  }

  if (convertedHave + 0.01 >= ingredient.quantity) {
    return {
      ingredientId: ingredient.id,
      status: "have_enough",
      pantryItemId: match.id,
      pantryItemName: match.name,
      pantryLocation: match.location,
      pantryQuantity: match.quantity,
      pantryUnit: match.unit,
      missingQuantity: 0,
      missingUnit: ingredient.unit,
      note: `Have ${formatQuantity(match.quantity)} ${match.unit} in ${match.location}`,
    };
  }

  const shortage = Math.max(0.1, Math.round((ingredient.quantity - convertedHave) * 100) / 100);
  return {
    ingredientId: ingredient.id,
    status: "partial",
    pantryItemId: match.id,
    pantryItemName: match.name,
    pantryLocation: match.location,
    pantryQuantity: match.quantity,
    pantryUnit: match.unit,
    missingQuantity: shortage,
    missingUnit: ingredient.unit,
    note: `Have ${formatQuantity(match.quantity)} ${match.unit} — need ${formatQuantity(shortage)} ${ingredient.unit} more`,
  };
}

export function evaluateRecipePantryMatch(
  ingredients: RecipeIngredient[],
  pantryItems: PantryItem[]
): {
  matches: Map<string, IngredientPantryMatch>;
  summary: RecipePantrySummary;
} {
  const matches = new Map<string, IngredientPantryMatch>();
  let haveCount = 0;
  let partialCount = 0;
  let missingCount = 0;
  let missingCostCents = 0;

  for (const ing of ingredients) {
    const m = matchIngredientToPantry(ing, pantryItems);
    matches.set(ing.id, m);

    if (m.status === "have_enough") {
      haveCount += 1;
    } else if (m.status === "partial" || m.status === "low_stock") {
      partialCount += 1;
      const ratio =
        ing.quantity && m.missingQuantity
          ? Math.min(1, m.missingQuantity / ing.quantity)
          : 1;
      missingCostCents += Math.round(ing.estimatedCostCents * ratio);
    } else {
      missingCount += 1;
      missingCostCents += ing.estimatedCostCents;
    }
  }

  const totalCount = ingredients.length;
  const readyPct = totalCount > 0 ? Math.round((haveCount / totalCount) * 100) : 100;

  return {
    matches,
    summary: {
      haveCount,
      partialCount,
      missingCount,
      totalCount,
      readyPct,
      missingCostCents,
    },
  };
}
