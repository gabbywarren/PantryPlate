import { canonicalizeIngredientName, guessAisle } from "./foodDatabase";
import { isKnownUnit, normalizeUnit, parseQuantityString } from "./unitConverter";
import type { IngredientInput } from "./types";

export interface ParsedRecipeDraft {
  title: string;
  description: string;
  sourceHandle: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: IngredientInput[];
  steps: string[];
}

const INSTAGRAM_NOISE_PATTERNS = [
  /^\d{1,2}:\d{2}\s*(am|pm)?$/i,
  /^(5g|lte|wifi|4g|3g|\d{1,3}%)$/i,
  /^(like|liked by|comment|share|save|saved|follow|following|more|less|\.\.\.\s*more)$/i,
  /^view all \d+ comments?$/i,
  /^\d+\s*(likes?|comments?|shares?|views?|s|m|h|d|w)\s*(ago)?$/i,
  /^(original audio|sponsored|paid partnership|suggested for you|add a comment)/i,
  /^(reels|posts|tagged|audio)$/i,
  /^[\s•·|—–\-_*=+<>~`]+$/,
];

const INGREDIENT_HEADER_RE = /^(ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need|shopping list|for the .+:)\s*:?$/i;
const STEP_HEADER_RE = /^(instructions?|directions?|method|preparation|steps?|how to make( it)?|recipe)\s*:?$/i;

const ACTION_VERB_RE =
  /^(preheat|heat|boil|simmer|saute|sauté|cook|bake|roast|mix|stir|whisk|combine|add|pour|toss|chop|dice|slice|mince|season|serve|top|garnish|transfer|drain|bring|place|spread|brush|fold|blend|marinate|grill|sear|fry|melt|cover|let|remove|set aside|meanwhile|in a |toast|mash|whip|beat|peel|rinse|soak|warm|chill|freeze|cool|rest|flip|turn|cut|cube|crumble|drizzle|sprinkle|squeeze|zest|layer|assemble|arrange|divide|pat|rub|coat|deglaze|reduce|strain|puree|purée|pulse)\b/i;

export function parseIngredientLine(rawLine: string): IngredientInput {
  let line = rawLine
    .replace(/^[\s•·▪▫◦‣⁃\-*+✓✔☐☑✅🟢🔸🔹👉➡️]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!line) {
    return { rawText: rawLine, quantity: null, unit: "", name: "", canonicalName: "", aisle: "Other", notes: "" };
  }

  // Extract trailing notes after comma or inside parentheses at the end
  let notes = "";
  const commaIdx = line.indexOf(",");
  if (commaIdx > 0 && commaIdx < line.length - 1) {
    notes = line.slice(commaIdx + 1).trim();
    line = line.slice(0, commaIdx).trim();
  }

  // Extract leading quantity (handles "1 1/2", "1/2", "½", "2-3", "1.5", "1½")
  let quantity: number | null = null;
  let rest = line;

  const qtyMatch = rest.match(
    /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?\s*(?:-|–|—|to)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(.*)$/i
  );

  if (qtyMatch) {
    quantity = parseQuantityString(qtyMatch[1]);
    rest = qtyMatch[2].trim();
  }

  // Handle package parenthetical right after qty, e.g. "1 (15 oz) can black beans"
  let unit = "";
  const parenSizeMatch = rest.match(/^\(([^)]+)\)\s+(.+)$/);
  if (parenSizeMatch) {
    const inside = parenSizeMatch[1].trim();
    rest = parenSizeMatch[2].trim();
    notes = notes ? `${inside}; ${notes}` : inside;
  }

  // Handle attached unit like "200g pasta" or "2tbsp olive oil"
  const attachedMatch = rest.match(/^(g|kg|ml|l|oz|lb|lbs|tbsp|tsp)\b\.?\s+(.+)$/i);
  if (attachedMatch) {
    unit = normalizeUnit(attachedMatch[1]);
    rest = attachedMatch[2].trim();
  } else {
    // Check two-word units like "fl oz"
    const twoWordMatch = rest.match(/^(fl\.?\s+oz\.?)\s+(.+)$/i);
    if (twoWordMatch) {
      unit = "fl oz";
      rest = twoWordMatch[2].trim();
    } else {
      const tokens = rest.split(/\s+/);
      if (tokens.length >= 2 && isKnownUnit(tokens[0])) {
        unit = normalizeUnit(tokens[0]);
        rest = tokens.slice(1).join(" ").trim();
      }
    }
  }

  // Strip leading "of " after a unit (e.g., "2 cloves of garlic" -> "garlic")
  rest = rest.replace(/^of\s+/i, "").trim();

  // If still empty name, fallback to cleaned rawLine
  const name = rest || line;
  const canonicalName = canonicalizeIngredientName(name);
  const aisle = guessAisle(name);

  return {
    rawText: rawLine.trim(),
    quantity,
    unit: unit || (quantity !== null ? "each" : ""),
    name,
    canonicalName,
    aisle,
    notes,
  };
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length === 1 && !/\d/.test(trimmed)) return true;
  return INSTAGRAM_NOISE_PATTERNS.some((re) => re.test(trimmed));
}

function looksLikeIngredientLine(line: string): boolean {
  const cleaned = line.replace(/^[\s•·▪▫◦‣⁃\-*+]+/, "").trim();
  if (!cleaned) return false;
  // Numbered steps like "1. Preheat the oven to 400F" are NOT ingredients
  if (/^\d+[.)]\s+[A-Z]?[a-z]+\s+/.test(cleaned) && ACTION_VERB_RE.test(cleaned.replace(/^\d+[.)]\s+/, ""))) {
    return false;
  }
  if (/^\d+[.)]\s+/.test(cleaned) && cleaned.length > 55) {
    return false;
  }
  // Starts with fraction/number + short/medium phrase
  if (/^(\d+|[¼½¾⅓⅔⅛⅜⅝⅞])/.test(cleaned) && cleaned.length < 95) {
    return true;
  }
  // Contains measurement word near start
  if (/^(a\s+)?(pinch|dash|handful|splash|drizzle|bunch|clove|can|cup|tbsp|tsp)\b/i.test(cleaned)) {
    return true;
  }
  // Bullet line that doesn't start with an action verb
  if (/^[•·▪▫◦‣⁃\-*+]\s+/.test(line.trim()) && !ACTION_VERB_RE.test(cleaned) && cleaned.length < 80) {
    return true;
  }
  return false;
}

export function parseRecipeText(rawText: string): ParsedRecipeDraft {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Extract Instagram handle and hashtags before stripping them
  let sourceHandle = "";
  const handleMatch = normalized.match(/(?:^|\s)@([a-zA-Z0-9._]{2,30})\b/);
  if (handleMatch) {
    sourceHandle = `@${handleMatch[1]}`;
  }

  const tagSet = new Set<string>();
  for (const m of normalized.matchAll(/#([a-zA-Z][a-zA-Z0-9_-]{2,24})\b/g)) {
    const tag = m[1].toLowerCase();
    if (!["fyp", "foryou", "reels", "instagram", "viral", "foodtok", "recipe", "recipes", "cooking"].includes(tag)) {
      tagSet.add(tag);
    }
    if (tagSet.size >= 5) break;
  }

  // Extract servings, prep time, cook time
  let servings = 4;
  const servMatch = normalized.match(/(?:serves?|servings?|yield|makes)\s*:?\s*(\d{1,2})/i);
  if (servMatch) {
    const parsed = Number(servMatch[1]);
    if (parsed >= 1 && parsed <= 24) servings = parsed;
  }

  let prepMinutes = 10;
  let cookMinutes = 20;
  const prepMatch = normalized.match(/prep(?:\s*time)?\s*:?\s*(\d{1,3})\s*(min|mins|minutes|hr|hrs|hour|hours)/i);
  if (prepMatch) {
    prepMinutes = /hr|hour/i.test(prepMatch[2]) ? Number(prepMatch[1]) * 60 : Number(prepMatch[1]);
  }
  const cookMatch = normalized.match(/cook(?:\s*time)?\s*:?\s*(\d{1,3})\s*(min|mins|minutes|hr|hrs|hour|hours)/i);
  if (cookMatch) {
    cookMinutes = /hr|hour/i.test(cookMatch[2]) ? Number(cookMatch[1]) * 60 : Number(cookMatch[1]);
  }
  const totalMatch = normalized.match(/(?:total(?:\s*time)?|ready in)\s*:?\s*(\d{1,3})\s*(min|mins|minutes)/i);
  if (totalMatch && !prepMatch && !cookMatch) {
    const total = Number(totalMatch[1]);
    prepMinutes = Math.max(5, Math.round(total * 0.35));
    cookMinutes = Math.max(5, total - prepMinutes);
  }

  // Clean lines
  const rawLines = normalized
    .split("\n")
    .map((l) => l.replace(/#[a-zA-Z0-9_-]+/g, "").trim())
    .filter((l) => !isNoiseLine(l));

  // Filter out pure handle-only header lines
  const lines = rawLines.filter((l) => !/^@[a-zA-Z0-9._]+(\s*•\s*follow)?$/i.test(l));

  let title = "";
  const descriptionLines: string[] = [];
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];

  type Section = "header" | "ingredients" | "steps";
  let section: Section = "header";

  for (const line of lines) {
    if (INGREDIENT_HEADER_RE.test(line)) {
      section = "ingredients";
      continue;
    }
    if (STEP_HEADER_RE.test(line)) {
      section = "steps";
      continue;
    }

    // Skip metadata-only lines (e.g., "Prep: 10 min | Cook: 20 min | Serves 4")
    if (/^(prep|cook|total|serves|servings|yield)\b/i.test(line) && line.length < 75 && !ACTION_VERB_RE.test(line)) {
      continue;
    }

    if (section === "header") {
      if (!title && !looksLikeIngredientLine(line) && !ACTION_VERB_RE.test(line)) {
        // Strip leading emoji/symbols for a clean title
        title = line.replace(/^[^\p{L}\p{N}]+/u, "").trim();
        continue;
      }
      if (looksLikeIngredientLine(line)) {
        section = "ingredients";
        ingredientLines.push(line);
        continue;
      }
      if (/^\d+[.)]\s+/.test(line) || ACTION_VERB_RE.test(line)) {
        section = "steps";
        stepLines.push(line);
        continue;
      }
      descriptionLines.push(line);
    } else if (section === "ingredients") {
      // Detect transition from ingredients to numbered steps if header was omitted
      const strippedStep = line.replace(/^\d+[.)]\s+/, "");
      if (
        /^\d+[.)]\s+/.test(line) ||
        (ACTION_VERB_RE.test(strippedStep) && strippedStep.length > 28)
      ) {
        section = "steps";
        stepLines.push(line);
      } else if (/^for the .+:/i.test(line)) {
        // Sub-header inside ingredients, skip cleanly
        continue;
      } else {
        ingredientLines.push(line);
      }
    } else {
      // Steps section
      stepLines.push(line);
    }
  }

  // Merge wrapped lines in steps when not starting a new numbered item
  const mergedSteps: string[] = [];
  for (const rawStep of stepLines) {
    const cleaned = rawStep.replace(/^(\d+[.)]|step\s*\d+:?|[-•*])\s*/i, "").trim();
    if (!cleaned) continue;
    const isExplicitNewStep = /^(\d+[.)]|step\s*\d+:?|[-•*])\s*/i.test(rawStep);
    if (
      !isExplicitNewStep &&
      mergedSteps.length > 0 &&
      !/[.!?]$/.test(mergedSteps[mergedSteps.length - 1]) &&
      cleaned.length < 120
    ) {
      mergedSteps[mergedSteps.length - 1] = `${mergedSteps[mergedSteps.length - 1]} ${cleaned}`;
    } else {
      mergedSteps.push(cleaned);
    }
  }

  const ingredients = ingredientLines
    .map(parseIngredientLine)
    .filter((ing) => ing.name.length > 0);

  return {
    title: title || "Untitled Recipe",
    description: descriptionLines.join(" ").slice(0, 300),
    sourceHandle,
    servings,
    prepMinutes,
    cookMinutes,
    tags: Array.from(tagSet),
    ingredients,
    steps: mergedSteps,
  };
}
