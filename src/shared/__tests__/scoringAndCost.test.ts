import { describe, expect, it } from "vitest";
import { calculateRecipeCost } from "../costEstimator";
import {
  calculateRecipeNutrition,
  classifyAdditiveTag,
  scoreOpenFoodFactsProduct,
} from "../nutritionScore";
import type { IngredientInput, PriceOverride } from "../types";

describe("Yuka-style nutrition scoring", () => {
  it("gives a whole-food salmon & veggie bowl an Excellent (75+) score", () => {
    const healthyIngredients: IngredientInput[] = [
      { quantity: 1, unit: "lb", name: "salmon fillets", canonicalName: "salmon" },
      { quantity: 1, unit: "cup", name: "quinoa", canonicalName: "quinoa" },
      { quantity: 1, unit: "head", name: "broccoli", canonicalName: "broccoli" },
      { quantity: 3, unit: "cup", name: "baby spinach", canonicalName: "spinach" },
      { quantity: 1, unit: "each", name: "lemon", canonicalName: "lemon" },
    ];
    const result = calculateRecipeNutrition(healthyIngredients, 4);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.grade).toBe("excellent");
    expect(result.perServing.proteinG).toBeGreaterThan(20);
  });

  it("penalizes high-sugar/high-sat-fat ultra-processed dishes", () => {
    const indulgentIngredients: IngredientInput[] = [
      { quantity: 1, unit: "lb", name: "bacon", canonicalName: "bacon" },
      { quantity: 1, unit: "cup", name: "heavy cream", canonicalName: "heavy cream" },
      { quantity: 1, unit: "cup", name: "sugar", canonicalName: "sugar" },
      { quantity: 4, unit: "tbsp", name: "butter", canonicalName: "butter" },
      { quantity: 2, unit: "tbsp", name: "soy sauce", canonicalName: "soy sauce" },
    ];
    const result = calculateRecipeNutrition(indulgentIngredients, 4);
    expect(result.score).toBeLessThan(55);
    expect(result.negatives.length).toBeGreaterThan(0);
  });

  it("caps Open Food Facts products with high-risk additives at 49 (Yuka rule)", () => {
    const scored = scoreOpenFoodFactsProduct({
      nutriscoreScore: 0,
      nutriments: { energyKcal100g: 120, proteins100g: 12, fiber100g: 4, sugars100g: 2 },
      novaGroup: 4,
      additives: [classifyAdditiveTag("en:e250")], // Sodium Nitrite (high risk)
      isOrganic: false,
    });
    expect(scored.score).toBeLessThanOrEqual(49);
    expect(scored.negatives.some((n) => n.includes("high-risk"))).toBe(true);
  });
});

describe("costEstimator", () => {
  it("calculates realistic baseline cost and honors user price overrides", () => {
    const ings: IngredientInput[] = [
      { quantity: 2, unit: "lb", name: "chicken breast", canonicalName: "chicken breast" },
      { quantity: 2, unit: "tbsp", name: "olive oil", canonicalName: "olive oil" },
    ];

    const baseline = calculateRecipeCost(ings, 4);
    expect(baseline.totalCents).toBeGreaterThan(900);
    expect(baseline.perServingCents).toBe(Math.round(baseline.totalCents / 4));

    const overrides: Record<string, PriceOverride> = {
      "chicken breast": {
        canonicalName: "chicken breast",
        priceCents: 300,
        unit: "lb",
        source: "user",
        updatedAt: "",
      },
    };
    const custom = calculateRecipeCost(ings, 4, overrides);
    expect(custom.ingredientCosts[0].costCents).toBe(600);
    expect(custom.ingredientCosts[0].source).toBe("override");
  });
});
