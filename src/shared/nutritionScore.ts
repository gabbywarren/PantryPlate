import { lookupFoodReference } from "./foodDatabase";
import { unitToGrams } from "./unitConverter";
import type {
  FoodAdditiveInfo,
  FoodNutriments,
  FoodProduct,
  IngredientInput,
  NutritionBreakdown,
  NutritionContributor,
  NutritionGrade,
} from "./types";

// Curated subset of notable food additives aligned with Yuka's public risk tiers
const ADDITIVE_RISK_MAP: Record<string, { name: string; risk: FoodAdditiveInfo["risk"] }> = {
  e102: { name: "Tartrazine (Yellow 5)", risk: "high" },
  e104: { name: "Quinoline Yellow", risk: "high" },
  e110: { name: "Sunset Yellow (Yellow 6)", risk: "high" },
  e122: { name: "Azorubine", risk: "high" },
  e124: { name: "Ponceau 4R", risk: "high" },
  e127: { name: "Erythrosine (Red 3)", risk: "high" },
  e129: { name: "Allura Red (Red 40)", risk: "high" },
  e133: { name: "Brilliant Blue (Blue 1)", risk: "moderate" },
  e150c: { name: "Ammonia Caramel", risk: "moderate" },
  e150d: { name: "Sulfite Ammonia Caramel", risk: "moderate" },
  e171: { name: "Titanium Dioxide", risk: "high" },
  e211: { name: "Sodium Benzoate", risk: "moderate" },
  e220: { name: "Sulfur Dioxide", risk: "moderate" },
  e249: { name: "Potassium Nitrite", risk: "high" },
  e250: { name: "Sodium Nitrite", risk: "high" },
  e251: { name: "Sodium Nitrate", risk: "high" },
  e252: { name: "Potassium Nitrate", risk: "high" },
  e319: { name: "TBHQ", risk: "high" },
  e320: { name: "BHA", risk: "high" },
  e321: { name: "BHT", risk: "high" },
  e322: { name: "Lecithins", risk: "low" },
  e330: { name: "Citric Acid", risk: "low" },
  e338: { name: "Phosphoric Acid", risk: "moderate" },
  e407: { name: "Carrageenan", risk: "moderate" },
  e412: { name: "Guar Gum", risk: "low" },
  e415: { name: "Xanthan Gum", risk: "low" },
  e433: { name: "Polysorbate 80", risk: "moderate" },
  e450: { name: "Diphosphates", risk: "moderate" },
  e466: { name: "Carboxymethyl Cellulose", risk: "moderate" },
  e471: { name: "Mono- and Diglycerides", risk: "moderate" },
  e621: { name: "Monosodium Glutamate (MSG)", risk: "limited" },
  e950: { name: "Acesulfame K", risk: "moderate" },
  e951: { name: "Aspartame", risk: "moderate" },
  e955: { name: "Sucralose", risk: "moderate" },
};

export function gradeFromScore(score: number): NutritionGrade {
  if (score >= 75) return "excellent";
  if (score >= 50) return "good";
  if (score >= 25) return "mediocre";
  return "poor";
}

export function classifyAdditiveTag(rawTag: string): FoodAdditiveInfo {
  const code = rawTag.replace(/^en:/i, "").toLowerCase().trim();
  const known = ADDITIVE_RISK_MAP[code];
  if (known) {
    return { code: code.toUpperCase(), name: known.name, risk: known.risk };
  }
  return {
    code: code.toUpperCase(),
    name: code.toUpperCase(),
    risk: "limited",
  };
}

/**
 * Computes FSA/Ofcom-based Nutri-Score negative and positive points per 100g.
 * Lower raw Nutri-Score (-15 to +40) is healthier.
 */
function computeFsaNutriScore(n: {
  kcal: number;
  satFatG: number;
  sugarG: number;
  sodiumMg: number;
  fiberG: number;
  proteinG: number;
  fruitVegPct: number;
}): number {
  const kj = n.kcal * 4.184;

  // Negative points (0–10 each, total 0–40)
  const energyPts = Math.min(10, Math.floor(kj / 335));
  const satFatPts = Math.min(10, Math.floor(n.satFatG / 1));
  const sugarPts = Math.min(10, Math.floor(n.sugarG / 4.5));
  const sodiumPts = Math.min(10, Math.floor(n.sodiumMg / 90));
  const negTotal = energyPts + satFatPts + sugarPts + sodiumPts;

  // Positive points (0–5 each, total 0–15)
  const fvnPts = n.fruitVegPct >= 80 ? 5 : n.fruitVegPct >= 60 ? 2 : n.fruitVegPct >= 40 ? 1 : 0;
  const fiberPts = Math.min(5, Math.floor(n.fiberG / 0.9));
  const proteinPts = Math.min(5, Math.floor(n.proteinG / 1.6));

  // FSA protein cap rule: if negTotal >= 11 and fvnPts < 5, protein doesn't offset
  const posTotal = negTotal >= 11 && fvnPts < 5 ? fvnPts + fiberPts : fvnPts + fiberPts + proteinPts;

  return negTotal - posTotal;
}

/**
 * Maps FSA raw score (-15 .. +35) smoothly onto Yuka's 60-point nutritional dimension.
 */
function nutriScoreTo60(fsaScore: number): number {
  // Clamp between -10 (perfect 60/60) and +26 (0/60)
  const clamped = Math.max(-10, Math.min(26, fsaScore));
  const ratio = (26 - clamped) / 36;
  return Math.round(ratio * 60);
}

/**
 * Computes Yuka-style 0–100 score for a single Open Food Facts barcoded product.
 */
export function scoreOpenFoodFactsProduct(params: {
  nutriscoreScore: number | null;
  nutriments: FoodNutriments;
  novaGroup: number | null;
  additives: FoodAdditiveInfo[];
  isOrganic: boolean;
}): { score: number; grade: NutritionGrade; positives: string[]; negatives: string[] } {
  const { nutriscoreScore, nutriments, novaGroup, additives, isOrganic } = params;
  const positives: string[] = [];
  const negatives: string[] = [];

  const kcal = nutriments.energyKcal100g ?? 180;
  const satFatG = nutriments.saturatedFat100g ?? 2;
  const sugarG = nutriments.sugars100g ?? 4;
  const sodiumMg =
    nutriments.sodiumMg100g ??
    (nutriments.salt100g !== undefined ? nutriments.salt100g * 400 : 250);
  const fiberG = nutriments.fiber100g ?? 2;
  const proteinG = nutriments.proteins100g ?? 5;
  const fruitVegPct = nutriments.fruitsVegetablesNuts100g ?? 0;

  const fsa =
    nutriscoreScore !== null && Number.isFinite(nutriscoreScore)
      ? nutriscoreScore
      : computeFsaNutriScore({ kcal, satFatG, sugarG, sodiumMg, fiberG, proteinG, fruitVegPct });

  const nutritionPoints = nutriScoreTo60(fsa);

  // Additives & ultra-processing (30 points)
  let additivesPoints = 30;
  let hasHighRisk = false;
  for (const add of additives) {
    if (add.risk === "high") {
      additivesPoints -= 15;
      hasHighRisk = true;
    } else if (add.risk === "moderate") {
      additivesPoints -= 7;
    } else if (add.risk === "limited") {
      additivesPoints -= 3;
    }
  }
  if (novaGroup === 4) {
    additivesPoints -= 8;
    negatives.push("Ultra-processed (NOVA 4)");
  } else if (novaGroup === 3) {
    additivesPoints -= 2;
  } else if (novaGroup === 1) {
    positives.push("Unprocessed whole food (NOVA 1)");
  }
  additivesPoints = Math.max(0, additivesPoints);

  // Organic / whole-food bonus (10 points)
  let organicPoints = 0;
  if (isOrganic) {
    organicPoints = 10;
    positives.push("Certified Organic");
  } else if (novaGroup === 1 && additives.length === 0) {
    organicPoints = 6;
  }

  let total = nutritionPoints + additivesPoints + organicPoints;
  // Yuka rule: a high-risk additive caps maximum score at 49
  if (hasHighRisk) {
    total = Math.min(total, 49);
    negatives.push("Contains high-risk additive(s)");
  }

  // Nutrient callouts
  if (proteinG >= 10) positives.push(`High protein (${proteinG.toFixed(1)}g / 100g)`);
  if (fiberG >= 4) positives.push(`Good source of fiber (${fiberG.toFixed(1)}g / 100g)`);
  if (fruitVegPct >= 50) positives.push("Rich in fruits, vegetables, or nuts");
  if (additives.length === 0) positives.push("No additives detected");

  if (sugarG >= 15) negatives.push(`High sugar (${sugarG.toFixed(1)}g / 100g)`);
  if (satFatG >= 6) negatives.push(`High saturated fat (${satFatG.toFixed(1)}g / 100g)`);
  if (sodiumMg >= 600) negatives.push(`High sodium (${Math.round(sodiumMg)}mg / 100g)`);
  if (additives.length > 0 && !hasHighRisk) {
    negatives.push(`${additives.length} additive${additives.length > 1 ? "s" : ""} listed`);
  }

  const score = Math.max(0, Math.min(100, Math.round(total)));
  return {
    score,
    grade: gradeFromScore(score),
    positives: positives.slice(0, 4),
    negatives: negatives.slice(0, 4),
  };
}

/**
 * Computes Yuka-style 0–100 Nutrition Score & full macro breakdown for a home-cooked recipe.
 */
export function calculateRecipeNutrition(
  ingredients: IngredientInput[],
  servings: number,
  linkedProducts: Record<string, FoodProduct> = {}
): NutritionBreakdown {
  const safeServings = Math.max(1, servings || 4);

  let totalGrams = 0;
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalSatFat = 0;
  let totalFiber = 0;
  let totalSugar = 0;
  let totalSodium = 0;
  let fruitVegGrams = 0;
  let wholeFoodGrams = 0;
  let ultraProcessedGrams = 0;
  let matchedCount = 0;

  let additivePenalty = 0;
  let hasHighRiskAdditive = false;
  const contributors: NutritionContributor[] = [];

  for (const ing of ingredients) {
    const qty = ing.quantity ?? 1;
    const linked = ing.foodBarcode ? linkedProducts[ing.foodBarcode] : undefined;
    const foodRef = lookupFoodReference(ing.canonicalName || ing.name);

    const grams = Math.max(1, unitToGrams(qty, ing.unit, foodRef) ?? 50);

    if (linked) {
      matchedCount += 1;
      const factor = grams / 100;
      const n = linked.nutriments;
      const kcal = (n.energyKcal100g ?? 180) * factor;
      const protein = (n.proteins100g ?? 5) * factor;
      const carbs = (n.carbohydrates100g ?? 20) * factor;
      const fat = (n.fat100g ?? 6) * factor;
      const satFat = (n.saturatedFat100g ?? 2) * factor;
      const fiber = (n.fiber100g ?? 1.5) * factor;
      const sugar = (n.sugars100g ?? 4) * factor;
      const sodium =
        (n.sodiumMg100g ?? (n.salt100g !== undefined ? n.salt100g * 400 : 250)) * factor;

      totalGrams += grams;
      totalKcal += kcal;
      totalProtein += protein;
      totalCarbs += carbs;
      totalFat += fat;
      totalSatFat += satFat;
      totalFiber += fiber;
      totalSugar += sugar;
      totalSodium += sodium;
      fruitVegGrams += grams * ((n.fruitsVegetablesNuts100g ?? 0) / 100);

      if (linked.isOrganic || linked.novaGroup === 1) {
        wholeFoodGrams += grams;
      }
      if (linked.novaGroup === 4) {
        ultraProcessedGrams += grams;
      }

      for (const add of linked.additives) {
        if (add.risk === "high") {
          additivePenalty += 12;
          hasHighRiskAdditive = true;
        } else if (add.risk === "moderate") {
          additivePenalty += 5;
        } else if (add.risk === "limited") {
          additivePenalty += 2;
        }
      }

      contributors.push({
        name: linked.productName,
        impact: linked.yukaScore >= 70 ? "positive" : linked.yukaScore < 45 ? "negative" : "neutral",
        detail: `Scanned product • Yuka score ${linked.yukaScore}/100`,
      });
    } else if (foodRef) {
      matchedCount += 1;
      const factor = grams / 100;
      const p = foodRef.per100g;

      totalGrams += grams;
      totalKcal += p.kcal * factor;
      totalProtein += p.proteinG * factor;
      totalCarbs += p.carbsG * factor;
      totalFat += p.fatG * factor;
      totalSatFat += p.satFatG * factor;
      totalFiber += p.fiberG * factor;
      totalSugar += p.sugarG * factor;
      totalSodium += p.sodiumMg * factor;
      fruitVegGrams += grams * (p.fruitVegPct / 100);

      if (foodRef.novaGroup === 1) {
        wholeFoodGrams += grams;
      } else if (foodRef.novaGroup === 4) {
        ultraProcessedGrams += grams;
      }

      if (p.fruitVegPct >= 80 && grams >= 50) {
        contributors.push({
          name: ing.name,
          impact: "positive",
          detail: "Whole produce / plant fiber boost",
        });
      } else if (p.proteinG >= 18 && p.satFatG <= 4 && grams >= 80) {
        contributors.push({
          name: ing.name,
          impact: "positive",
          detail: "Lean whole-food protein",
        });
      } else if ((p.satFatG >= 15 && grams >= 30) || (p.sodiumMg >= 1000 && grams >= 25) || (p.sugarG >= 50 && grams >= 30)) {
        contributors.push({
          name: ing.name,
          impact: "negative",
          detail:
            p.sodiumMg >= 1000
              ? "High sodium contribution"
              : p.sugarG >= 50
                ? "Added sugar"
                : "High saturated fat",
        });
      }
    }
  }

  if (totalGrams <= 0) {
    return {
      score: 68,
      grade: "good",
      nutritionPoints: 36,
      additivesPoints: 26,
      wholeFoodPoints: 6,
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
      positives: ["Add quantities for a precise nutrition score"],
      negatives: [],
      contributors: [],
      coveragePct: 0,
    };
  }

  // Per-100g aggregate of the finished cooked dish
  const per100Factor = 100 / totalGrams;
  const fsaScore = computeFsaNutriScore({
    kcal: totalKcal * per100Factor,
    satFatG: totalSatFat * per100Factor,
    sugarG: totalSugar * per100Factor,
    sodiumMg: totalSodium * per100Factor,
    fiberG: totalFiber * per100Factor,
    proteinG: totalProtein * per100Factor,
    fruitVegPct: (fruitVegGrams / totalGrams) * 100,
  });

  const nutritionPoints = nutriScoreTo60(fsaScore);

  const ultraProcessedRatio = ultraProcessedGrams / totalGrams;
  const processingPenalty = Math.round(ultraProcessedRatio * 18);
  const additivesPoints = Math.max(0, 30 - additivePenalty - processingPenalty);

  const wholeFoodRatio = wholeFoodGrams / totalGrams;
  const wholeFoodPoints = Math.round(wholeFoodRatio * 10);

  let rawScore = nutritionPoints + additivesPoints + wholeFoodPoints;
  if (hasHighRiskAdditive) {
    rawScore = Math.min(rawScore, 49);
  }
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const perServing = {
    calories: Math.round(totalKcal / safeServings),
    proteinG: Math.round((totalProtein / safeServings) * 10) / 10,
    carbsG: Math.round((totalCarbs / safeServings) * 10) / 10,
    fatG: Math.round((totalFat / safeServings) * 10) / 10,
    saturatedFatG: Math.round((totalSatFat / safeServings) * 10) / 10,
    fiberG: Math.round((totalFiber / safeServings) * 10) / 10,
    sugarG: Math.round((totalSugar / safeServings) * 10) / 10,
    sodiumMg: Math.round(totalSodium / safeServings),
  };

  const positives: string[] = [];
  const negatives: string[] = [];

  if (wholeFoodRatio >= 0.7) positives.push(`${Math.round(wholeFoodRatio * 100)}% whole unprocessed ingredients`);
  if (perServing.proteinG >= 20) positives.push(`High protein (${perServing.proteinG}g / serving)`);
  if (perServing.fiberG >= 5) positives.push(`Good fiber (${perServing.fiberG}g / serving)`);
  if (fruitVegGrams / totalGrams >= 0.35) positives.push("Packed with vegetables / legumes");
  if (additivePenalty === 0 && ultraProcessedRatio < 0.05) positives.push("Clean home-cooked ingredients (no additives)");

  if (perServing.sodiumMg >= 900) negatives.push(`High sodium (${perServing.sodiumMg}mg / serving)`);
  if (perServing.saturatedFatG >= 10) negatives.push(`High saturated fat (${perServing.saturatedFatG}g / serving)`);
  if (perServing.sugarG >= 18) negatives.push(`High sugar (${perServing.sugarG}g / serving)`);
  if (ultraProcessedRatio >= 0.2) negatives.push("Contains ultra-processed ingredients");
  if (hasHighRiskAdditive) negatives.push("Includes a high-risk additive from scanned product");

  return {
    score,
    grade: gradeFromScore(score),
    nutritionPoints,
    additivesPoints,
    wholeFoodPoints,
    perServing,
    positives: positives.slice(0, 4),
    negatives: negatives.slice(0, 4),
    contributors: contributors.slice(0, 6),
    coveragePct: ingredients.length > 0 ? Math.round((matchedCount / ingredients.length) * 100) : 0,
  };
}
