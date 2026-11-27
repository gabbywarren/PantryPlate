import { describe, expect, it } from "vitest";
import {
  formatIngredientMeasurement,
  matchIngredientsForStep,
} from "../stepIngredients";
import type { RecipeIngredient } from "../types";

const sampleIngredients: RecipeIngredient[] = [
  {
    id: "1",
    quantity: 1.5,
    unit: "lb",
    name: "salmon fillets",
    canonicalName: "salmon",
    aisle: "Meat & Seafood",
    notes: "skin-on",
    estimatedCostCents: 1799,
    sortOrder: 0,
  },
  {
    id: "2",
    quantity: 2,
    unit: "tbsp",
    name: "olive oil",
    canonicalName: "olive oil",
    aisle: "Spices & Oils",
    notes: "",
    estimatedCostCents: 44,
    sortOrder: 1,
  },
  {
    id: "3",
    quantity: 3,
    unit: "clove",
    name: "garlic",
    canonicalName: "garlic",
    aisle: "Produce",
    notes: "minced",
    estimatedCostCents: 30,
    sortOrder: 2,
  },
  {
    id: "4",
    quantity: 1,
    unit: "head",
    name: "broccoli",
    canonicalName: "broccoli",
    aisle: "Produce",
    notes: "cut into florets",
    estimatedCostCents: 249,
    sortOrder: 3,
  },
  {
    id: "5",
    quantity: 0.5,
    unit: "tsp",
    name: "kosher salt",
    canonicalName: "salt",
    aisle: "Spices & Oils",
    notes: "",
    estimatedCostCents: 5,
    sortOrder: 4,
  },
];

describe("stepIngredients", () => {
  it("matches referenced ingredients in order of appearance inside a step", () => {
    const step =
      "Toss broccoli florets with olive oil, minced garlic, and salt. Roast until crisp.";
    const matched = matchIngredientsForStep(step, sampleIngredients);
    expect(matched.map((i) => i.canonicalName)).toEqual([
      "broccoli",
      "olive oil",
      "garlic",
      "salt",
    ]);
  });

  it("matches core food noun like salmon to salmon fillets", () => {
    const step = "Pat salmon dry and sear skin-side down in olive oil for 4 minutes.";
    const matched = matchIngredientsForStep(step, sampleIngredients);
    expect(matched.map((i) => i.canonicalName)).toEqual(["salmon", "olive oil"]);
  });

  it("formats scaled measurements with clean pluralized units", () => {
    expect(formatIngredientMeasurement(sampleIngredients[0], 1)).toBe("1 ½ lb salmon fillets");
    expect(formatIngredientMeasurement(sampleIngredients[2], 1)).toBe("3 cloves garlic");
    expect(formatIngredientMeasurement(sampleIngredients[3], 2)).toBe("2 heads broccoli");
    expect(formatIngredientMeasurement(sampleIngredients[4], 2)).toBe("1 tsp kosher salt");
  });
});
