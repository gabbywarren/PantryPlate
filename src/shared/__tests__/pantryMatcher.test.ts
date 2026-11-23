import { describe, expect, it } from "vitest";
import { evaluateRecipePantryMatch, matchIngredientToPantry } from "../pantryMatcher";
import type { PantryItem, RecipeIngredient } from "../types";

const basePantry: PantryItem[] = [
  {
    id: "p1",
    name: "Kirkland Extra Virgin Olive Oil",
    canonicalName: "olive oil",
    location: "spices",
    quantity: 1,
    unit: "bottle",
    stockStatus: "in_stock",
    barcode: "0096619123456",
    brand: "Kirkland",
    imageUrl: "",
    unitPriceCents: null,
    priceUnit: "",
    expiresAt: null,
    updatedAt: "",
  },
  {
    id: "p2",
    name: "Chicken Breast",
    canonicalName: "chicken breast",
    location: "fridge",
    quantity: 8,
    unit: "oz",
    stockStatus: "in_stock",
    barcode: null,
    brand: "",
    imageUrl: "",
    unitPriceCents: null,
    priceUnit: "",
    expiresAt: null,
    updatedAt: "",
  },
  {
    id: "p3",
    name: "Garlic",
    canonicalName: "garlic",
    location: "pantry",
    quantity: 2,
    unit: "clove",
    stockStatus: "low",
    barcode: null,
    brand: "",
    imageUrl: "",
    unitPriceCents: null,
    priceUnit: "",
    expiresAt: null,
    updatedAt: "",
  },
  {
    id: "p4",
    name: "Spinach",
    canonicalName: "spinach",
    location: "fridge",
    quantity: 0,
    unit: "bag",
    stockStatus: "out",
    barcode: null,
    brand: "",
    imageUrl: "",
    unitPriceCents: null,
    priceUnit: "",
    expiresAt: null,
    updatedAt: "",
  },
];

describe("pantryMatcher", () => {
  it("treats bulk bottles as covering tablespoon amounts", () => {
    const ing: RecipeIngredient = {
      id: "i1",
      quantity: 2,
      unit: "tbsp",
      name: "extra virgin olive oil",
      canonicalName: "olive oil",
      aisle: "Spices & Oils",
      notes: "",
      estimatedCostCents: 44,
      sortOrder: 0,
    };
    const match = matchIngredientToPantry(ing, basePantry);
    expect(match.status).toBe("have_enough");
    expect(match.pantryLocation).toBe("spices");
  });

  it("detects unit-converted partial shortages (oz in fridge vs lb needed)", () => {
    const ing: RecipeIngredient = {
      id: "i2",
      quantity: 1.5,
      unit: "lb",
      name: "chicken breast",
      canonicalName: "chicken breast",
      aisle: "Meat & Seafood",
      notes: "",
      estimatedCostCents: 750,
      sortOrder: 1,
    };
    const match = matchIngredientToPantry(ing, basePantry);
    expect(match.status).toBe("partial");
    expect(match.missingQuantity).toBeCloseTo(1, 1);
  });

  it("flags low_stock items and treats out-of-stock items as missing", () => {
    const ingredients: RecipeIngredient[] = [
      {
        id: "i1",
        quantity: 2,
        unit: "tbsp",
        name: "olive oil",
        canonicalName: "olive oil",
        aisle: "Spices & Oils",
        notes: "",
        estimatedCostCents: 44,
        sortOrder: 0,
      },
      {
        id: "i3",
        quantity: 3,
        unit: "clove",
        name: "garlic",
        canonicalName: "garlic",
        aisle: "Produce",
        notes: "",
        estimatedCostCents: 30,
        sortOrder: 1,
      },
      {
        id: "i4",
        quantity: 3,
        unit: "cup",
        name: "baby spinach",
        canonicalName: "spinach",
        aisle: "Produce",
        notes: "",
        estimatedCostCents: 220,
        sortOrder: 2,
      },
    ];

    const { matches, summary } = evaluateRecipePantryMatch(ingredients, basePantry);
    expect(matches.get("i1")?.status).toBe("have_enough");
    expect(matches.get("i3")?.status).toBe("low_stock");
    expect(matches.get("i4")?.status).toBe("missing");
    expect(summary.haveCount).toBe(1);
    expect(summary.partialCount).toBe(1);
    expect(summary.missingCount).toBe(1);
    expect(summary.missingCostCents).toBe(250);
  });
});
