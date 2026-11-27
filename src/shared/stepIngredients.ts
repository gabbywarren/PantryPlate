import { cleanIngredientName, stripPrepWords } from "./foodDatabase";
import type { RecipeIngredient } from "./types";
import { formatQuantity } from "./unitConverter";

const GENERIC_HEAD_NOUNS = new Set([
  "oil",
  "sauce",
  "cheese",
  "beans",
  "bean",
  "milk",
  "cream",
  "flour",
  "sugar",
  "powder",
  "broth",
  "stock",
  "vinegar",
  "bread",
  "seasoning",
  "paste",
  "juice",
  "zest",
  "leaves",
  "leaf",
  "fillet",
  "fillets",
  "breast",
  "breasts",
  "thigh",
  "thighs",
  "florets",
  "spears",
  "strips",
  "slices",
  "cloves",
  "clove",
  "seeds",
  "flakes",
]);

const MODIFIER_WORDS = new Set([
  "fresh",
  "freshly",
  "dried",
  "ground",
  "chopped",
  "diced",
  "minced",
  "sliced",
  "grated",
  "shredded",
  "crushed",
  "peeled",
  "seeded",
  "halved",
  "quartered",
  "trimmed",
  "rinsed",
  "drained",
  "cooked",
  "uncooked",
  "raw",
  "melted",
  "softened",
  "divided",
  "optional",
  "finely",
  "roughly",
  "thinly",
  "coarsely",
  "large",
  "medium",
  "small",
  "baby",
  "sweet",
  "yellow",
  "red",
  "green",
  "white",
  "black",
  "brown",
  "purple",
  "orange",
  "gold",
  "yukon",
  "extra",
  "virgin",
  "kosher",
  "sea",
  "flaky",
  "unsalted",
  "salted",
  "smoked",
  "italian",
  "plain",
  "whole",
  "lean",
  "boneless",
  "skinless",
  "skin-on",
  "thick-cut",
  "fire-roasted",
  "canned",
  "frozen",
  "ripe",
  "organic",
  "low-sodium",
  "full-fat",
  "light",
]);

const PLURALIZABLE_UNITS: Record<string, string> = {
  cup: "cups",
  clove: "cloves",
  can: "cans",
  jar: "jars",
  slice: "slices",
  strip: "strips",
  stick: "sticks",
  stalk: "stalks",
  head: "heads",
  bunch: "bunches",
  package: "packages",
  bag: "bags",
  box: "boxes",
  bottle: "bottles",
  block: "blocks",
  fillet: "fillets",
  breast: "breasts",
  thigh: "thighs",
  link: "links",
  pinch: "pinches",
  handful: "handfuls",
  sprig: "sprigs",
  pint: "pints",
  quart: "quarts",
  inch: "inches",
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function singularPluralVariants(phrase: string): string[] {
  const out = new Set<string>([phrase]);
  if (phrase.endsWith("ies") && phrase.length > 4) {
    out.add(`${phrase.slice(0, -3)}y`);
  } else if (phrase.endsWith("es") && phrase.length > 4) {
    out.add(phrase.slice(0, -2));
  } else if (phrase.endsWith("s") && phrase.length > 3 && !phrase.endsWith("ss")) {
    out.add(phrase.slice(0, -1));
  } else if (phrase.length > 2) {
    out.add(`${phrase}s`);
  }
  return Array.from(out);
}

function hasWordPhrase(haystack: string, phrase: string): boolean {
  if (!phrase || phrase.length < 3) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(phrase)}([^a-z0-9]|$)`, "i");
  return re.test(haystack);
}

export function formatIngredientMeasurement(
  ingredient: Pick<RecipeIngredient, "quantity" | "unit" | "name">,
  scale = 1
): string {
  const scaledQty =
    ingredient.quantity !== null
      ? Math.round(ingredient.quantity * scale * 100) / 100
      : null;

  if (scaledQty === null) {
    return ingredient.name;
  }

  const qtyText = formatQuantity(scaledQty);
  const rawUnit = (ingredient.unit || "").trim();
  if (!rawUnit || rawUnit === "each") {
    return `${qtyText} ${ingredient.name}`;
  }

  const displayUnit =
    scaledQty > 1 && PLURALIZABLE_UNITS[rawUnit]
      ? PLURALIZABLE_UNITS[rawUnit]
      : rawUnit;

  return `${qtyText} ${displayUnit} ${ingredient.name}`;
}

/**
 * Returns the recipe ingredients referenced in a given cooking step, in order of appearance,
 * ready to display as scaled measurement chips right inside the step card.
 */
export function matchIngredientsForStep(
  instruction: string,
  ingredients: RecipeIngredient[]
): RecipeIngredient[] {
  const text = instruction.toLowerCase();
  if (!text.trim() || ingredients.length === 0) return [];

  // Count how many ingredients share a fallback noun so we only match unambiguous short nouns
  const nounCounts = new Map<string, number>();
  const ingredientCandidates = ingredients.map((ing) => {
    const cleanedName = cleanIngredientName(ing.name);
    const strippedName = stripPrepWords(cleanedName);
    const canonical = (ing.canonicalName || "").toLowerCase().trim();

    const exactPhrases = new Set<string>();
    for (const base of [cleanedName, strippedName, canonical]) {
      if (base && base.length >= 3) {
        for (const v of singularPluralVariants(base)) {
          exactPhrases.add(v);
        }
      }
    }

    // Meaningful core tokens (e.g. "salmon" from "salmon fillets", "onion" from "yellow onion")
    const coreTokens = new Set<string>();
    for (const source of [strippedName, canonical]) {
      for (const tok of source.split(/\s+/)) {
        if (tok.length >= 4 && !MODIFIER_WORDS.has(tok) && !GENERIC_HEAD_NOUNS.has(tok)) {
          coreTokens.add(tok);
        }
      }
    }

    // Special case: "salt" (4 chars) and "egg"/"eggs" (3-4 chars) and "pea"/"peas"
    for (const shortFood of ["egg", "ham", "cod", "yam", "fig", "pea", "oat", "rye", "soy"]) {
      if (hasWordPhrase(cleanedName, shortFood) || hasWordPhrase(canonical, shortFood)) {
        coreTokens.add(shortFood);
      }
    }

    // Track last word as potential unique fallback (e.g. "oil" if olive oil is the only oil)
    const words = strippedName.split(/\s+/).filter(Boolean);
    const lastWord = words[words.length - 1] || "";
    if (lastWord.length >= 3) {
      const singularLast = lastWord.endsWith("s") && !lastWord.endsWith("ss") ? lastWord.slice(0, -1) : lastWord;
      nounCounts.set(singularLast, (nounCounts.get(singularLast) ?? 0) + 1);
    }

    return { ing, exactPhrases: Array.from(exactPhrases), coreTokens: Array.from(coreTokens), lastWord };
  });

  const matched: { ing: RecipeIngredient; index: number }[] = [];

  for (const cand of ingredientCandidates) {
    let bestIdx = -1;

    // 1. Check exact / canonical phrases first
    for (const phrase of cand.exactPhrases) {
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(phrase)}([^a-z0-9]|$)`, "i");
      const m = re.exec(text);
      if (m) {
        const pos = m.index;
        if (bestIdx === -1 || pos < bestIdx) bestIdx = pos;
      }
    }

    // 2. Check core tokens (e.g., "salmon" matching "salmon fillets")
    if (bestIdx === -1) {
      for (const tok of cand.coreTokens) {
        for (const v of singularPluralVariants(tok)) {
          const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(v)}([^a-z0-9]|$)`, "i");
          const m = re.exec(text);
          if (m) {
            const pos = m.index;
            if (bestIdx === -1 || pos < bestIdx) bestIdx = pos;
          }
        }
      }
    }

    // 3. Unique generic noun fallback (e.g. "pepper" when only black pepper is in the recipe, or "oil" when only olive oil)
    if (bestIdx === -1 && cand.lastWord.length >= 3) {
      const singularLast =
        cand.lastWord.endsWith("s") && !cand.lastWord.endsWith("ss")
          ? cand.lastWord.slice(0, -1)
          : cand.lastWord;
      if ((nounCounts.get(singularLast) ?? 0) === 1) {
        for (const v of singularPluralVariants(singularLast)) {
          const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(v)}([^a-z0-9]|$)`, "i");
          const m = re.exec(text);
          if (m) {
            bestIdx = m.index;
            break;
          }
        }
      }
    }

    if (bestIdx !== -1) {
      matched.push({ ing: cand.ing, index: bestIdx });
    }
  }

  matched.sort((a, b) => a.index - b.index);
  return matched.map((m) => m.ing);
}
