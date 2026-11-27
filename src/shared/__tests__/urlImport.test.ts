import { describe, expect, it } from "vitest";
import {
  extractRecipeFromHtmlJsonLd,
  parseIsoDurationMinutes,
  validatePublicHttpUrl,
} from "../../worker/lib/urlImport";

describe("urlImport helpers", () => {
  it("parses ISO-8601 durations cleanly", () => {
    expect(parseIsoDurationMinutes("PT15M")).toBe(15);
    expect(parseIsoDurationMinutes("PT1H20M")).toBe(80);
    expect(parseIsoDurationMinutes("P0DT0H45M")).toBe(45);
    expect(parseIsoDurationMinutes("30 mins")).toBe(30);
  });

  it("blocks localhost and private IPs while allowing public HTTPS URLs", () => {
    expect(validatePublicHttpUrl("allrecipes.com/recipe/123").toString()).toBe(
      "https://allrecipes.com/recipe/123"
    );
    expect(() => validatePublicHttpUrl("http://localhost:8080/secret")).toThrow();
    expect(() => validatePublicHttpUrl("http://192.168.1.5/admin")).toThrow();
    expect(() => validatePublicHttpUrl("http://169.254.169.254/latest/meta-data")).toThrow();
  });

  it("extracts Schema.org @graph Recipe with HowToSection and image object", () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              { "@type": "WebSite", "name": "Cozy Kitchen" },
              {
                "@type": ["Recipe"],
                "name": "One-Pot Garlic Parmesan Pasta",
                "description": "Creamy weeknight pasta ready in 20 minutes.",
                "author": { "@type": "Person", "name": "Chef Maya" },
                "prepTime": "PT5M",
                "cookTime": "PT15M",
                "recipeYield": ["4 servings"],
                "image": { "@type": "ImageObject", "url": "https://example.com/pasta.jpg" },
                "recipeCategory": ["Dinner", "Pasta"],
                "recipeIngredient": [
                  "12 oz spaghetti",
                  "4 cloves garlic, minced",
                  "2 tbsp butter",
                  "1/2 cup grated parmesan"
                ],
                "recipeInstructions": [
                  {
                    "@type": "HowToSection",
                    "name": "Cook",
                    "itemListElement": [
                      { "@type": "HowToStep", "text": "Sauté garlic in butter for 1 minute." },
                      { "@type": "HowToStep", "text": "Simmer pasta in broth and stir in parmesan." }
                    ]
                  }
                ]
              }
            ]
          }
          </script>
        </head>
        <body><h1>Blog story</h1></body>
      </html>
    `;

    const res = extractRecipeFromHtmlJsonLd(html, "https://example.com/garlic-pasta");
    expect(res).not.toBeNull();
    expect(res?.draft.title).toBe("One-Pot Garlic Parmesan Pasta");
    expect(res?.draft.sourceHandle).toBe("Chef Maya");
    expect(res?.draft.servings).toBe(4);
    expect(res?.draft.prepMinutes).toBe(5);
    expect(res?.draft.cookMinutes).toBe(15);
    expect(res?.draft.ingredients).toHaveLength(4);
    expect(res?.draft.ingredients[0].canonicalName).toBe("pasta");
    expect(res?.draft.steps).toEqual([
      "Sauté garlic in butter for 1 minute.",
      "Simmer pasta in broth and stir in parmesan.",
    ]);
    expect(res?.imageUrl).toBe("https://example.com/pasta.jpg");
  });
});
