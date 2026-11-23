import { describe, expect, it } from "vitest";
import { parseIngredientLine, parseRecipeText } from "../recipeParser";

describe("parseIngredientLine", () => {
  it("parses mixed unicode fractions, units, and prep notes", () => {
    const parsed = parseIngredientLine("• 1 ½ cups baby spinach, roughly chopped");
    expect(parsed.quantity).toBe(1.5);
    expect(parsed.unit).toBe("cup");
    expect(parsed.name).toBe("baby spinach");
    expect(parsed.canonicalName).toBe("spinach");
    expect(parsed.notes).toBe("roughly chopped");
    expect(parsed.aisle).toBe("Produce");
  });

  it("parses ranges and package size parentheticals", () => {
    const garlic = parseIngredientLine("2-3 cloves of garlic, minced");
    expect(garlic.quantity).toBe(2.5);
    expect(garlic.unit).toBe("clove");
    expect(garlic.canonicalName).toBe("garlic");

    const beans = parseIngredientLine("1 (15 oz) can black beans, drained");
    expect(beans.quantity).toBe(1);
    expect(beans.unit).toBe("can");
    expect(beans.canonicalName).toBe("black beans");
    expect(beans.notes).toContain("15 oz");
  });

  it("parses attached metric units like 200g", () => {
    const pasta = parseIngredientLine("200g spaghetti");
    expect(pasta.quantity).toBe(200);
    expect(pasta.unit).toBe("g");
    expect(pasta.canonicalName).toBe("pasta");
  });
});

describe("parseRecipeText", () => {
  it("strips Instagram chrome and parses ingredients, steps, handle, and tags", () => {
    const noisyOcr = `
      9:41
      @weeknightchef
      Follow
      Creamy Garlic Tuscan Chicken
      Serves 4 | Prep: 10 mins | Cook: 25 mins
      Ingredients:
      - 1.5 lb chicken breast
      - 2 tbsp extra virgin olive oil
      - 4 cloves garlic, minced
      - 2 cups baby spinach
      Instructions:
      1. Season chicken and sear in olive oil until golden.
      2. Add garlic and spinach and simmer until wilted.
      Like
      Comment
      Share
      View all 42 comments
      #highprotein #weeknightdinner #fyp
    `;

    const draft = parseRecipeText(noisyOcr);
    expect(draft.title).toBe("Creamy Garlic Tuscan Chicken");
    expect(draft.sourceHandle).toBe("@weeknightchef");
    expect(draft.servings).toBe(4);
    expect(draft.prepMinutes).toBe(10);
    expect(draft.cookMinutes).toBe(25);
    expect(draft.ingredients).toHaveLength(4);
    expect(draft.ingredients[1].canonicalName).toBe("olive oil");
    expect(draft.steps).toHaveLength(2);
    expect(draft.tags).toContain("highprotein");
    expect(draft.tags).not.toContain("fyp");
  });

  it("handles headerless captions cleanly", () => {
    const caption = `
      Quick Avocado Toast
      2 slices sourdough bread
      1 ripe avocado
      1/2 lemon
      1. Toast the sourdough slices until crisp.
      2. Mash avocado with lemon juice and spread on toast.
    `;
    const draft = parseRecipeText(caption);
    expect(draft.title).toBe("Quick Avocado Toast");
    expect(draft.ingredients).toHaveLength(3);
    expect(draft.steps).toHaveLength(2);
  });
});
