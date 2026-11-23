import type { FoodReferenceEntry } from "./foodDatabase";

const UNIT_ALIASES: Record<string, string> = {
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  t: "tsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  c: "cup",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  floz: "fl oz",
  "fl oz": "fl oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  jar: "jar",
  jars: "jar",
  package: "package",
  packages: "package",
  pkg: "package",
  bag: "bag",
  bags: "bag",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  stalk: "stalk",
  stalks: "stalk",
  rib: "rib",
  ribs: "rib",
  slice: "slice",
  slices: "slice",
  strip: "strip",
  strips: "strip",
  stick: "stick",
  sticks: "stick",
  pinch: "pinch",
  pinches: "pinch",
  dash: "pinch",
  handful: "handful",
  handfuls: "handful",
  pint: "pint",
  pints: "pint",
  quart: "quart",
  quarts: "quart",
  bottle: "bottle",
  bottles: "bottle",
  block: "block",
  blocks: "block",
  fillet: "fillet",
  fillets: "fillet",
  breast: "breast",
  breasts: "breast",
  thigh: "thigh",
  thighs: "thigh",
  link: "link",
  links: "link",
  box: "box",
  boxes: "box",
  carton: "carton",
  cartons: "carton",
  sprig: "sprig",
  sprigs: "sprig",
  inch: "inch",
  inches: "inch",
  each: "each",
  piece: "each",
  pieces: "each",
  whole: "each",
  large: "large",
  medium: "medium",
  small: "small",
};

const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
  "⅑": "1/9",
  "⅒": "1/10",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

// Base conversions: volume in ml, weight in grams
const VOLUME_TO_ML: Record<string, number> = {
  tsp: 4.929,
  tbsp: 14.787,
  "fl oz": 29.574,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  ml: 1,
  l: 1000,
  pinch: 0.6,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

export function normalizeUnit(unit: string): string {
  const cleaned = unit.trim().toLowerCase().replace(/\.$/, "");
  if (!cleaned) return "";
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

export function isKnownUnit(token: string): boolean {
  const cleaned = token.trim().toLowerCase().replace(/\.$/, "");
  return cleaned in UNIT_ALIASES;
}

export function parseQuantityString(raw: string): number | null {
  let str = raw.trim();
  if (!str) return null;

  // Replace unicode fractions with spaced ASCII fractions (e.g. "1½" -> "1 1/2")
  for (const [uni, frac] of Object.entries(UNICODE_FRACTIONS)) {
    str = str.replace(new RegExp(uni, "g"), ` ${frac}`);
  }
  str = str.replace(/\s+/g, " ").trim();

  // If range like "1-2" or "1 to 2", take the average
  const rangeMatch = str.match(/^(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?|\d+\s+\d+\/\d+|\d+\/\d+)$/i);
  if (rangeMatch) {
    const a = parseSingleNumber(rangeMatch[1]);
    const b = parseSingleNumber(rangeMatch[2]);
    if (a !== null && b !== null) return Math.round(((a + b) / 2) * 100) / 100;
  }

  return parseSingleNumber(str);
}

function parseSingleNumber(str: string): number | null {
  const trimmed = str.trim();
  // Mixed fraction "1 1/2"
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denom = Number(mixed[3]);
    if (denom === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / denom;
  }
  // Simple fraction "1/2"
  const frac = trimmed.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const denom = Number(frac[2]);
    if (denom === 0) return null;
    return Number(frac[1]) / denom;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

/**
 * Converts a quantity from one unit to another when both are in the same family
 * (volume or weight), or when foodReference provides gramsPerUnit for both.
 */
export function convertUnits(
  quantity: number,
  fromUnitRaw: string,
  toUnitRaw: string,
  foodRef?: FoodReferenceEntry | null
): number | null {
  const fromUnit = normalizeUnit(fromUnitRaw) || "each";
  const toUnit = normalizeUnit(toUnitRaw) || "each";
  if (fromUnit === toUnit) return quantity;

  // Direct volume-to-volume
  if (fromUnit in VOLUME_TO_ML && toUnit in VOLUME_TO_ML) {
    return (quantity * VOLUME_TO_ML[fromUnit]) / VOLUME_TO_ML[toUnit];
  }

  // Direct weight-to-weight
  if (fromUnit in WEIGHT_TO_G && toUnit in WEIGHT_TO_G) {
    return (quantity * WEIGHT_TO_G[fromUnit]) / WEIGHT_TO_G[toUnit];
  }

  // Convert via grams using food reference
  const fromGrams = unitToGrams(quantity, fromUnit, foodRef);
  const oneToGrams = unitToGrams(1, toUnit, foodRef);
  if (fromGrams !== null && oneToGrams !== null && oneToGrams > 0) {
    return fromGrams / oneToGrams;
  }

  return null;
}

export function unitToGrams(
  quantity: number,
  unitRaw: string,
  foodRef?: FoodReferenceEntry | null
): number | null {
  const unit = normalizeUnit(unitRaw) || "each";
  if (unit in WEIGHT_TO_G) {
    return quantity * WEIGHT_TO_G[unit];
  }
  if (foodRef && unit in foodRef.gramsPerUnit) {
    return quantity * foodRef.gramsPerUnit[unit];
  }
  // If foodRef has a cup/tbsp gram weight and unit is another volume unit, scale proportionally
  if (foodRef && unit in VOLUME_TO_ML) {
    if ("cup" in foodRef.gramsPerUnit) {
      const ml = quantity * VOLUME_TO_ML[unit];
      return (ml / VOLUME_TO_ML.cup) * foodRef.gramsPerUnit.cup;
    }
    if ("tbsp" in foodRef.gramsPerUnit) {
      const ml = quantity * VOLUME_TO_ML[unit];
      return (ml / VOLUME_TO_ML.tbsp) * foodRef.gramsPerUnit.tbsp;
    }
    // Generic water-like density fallback
    return quantity * VOLUME_TO_ML[unit];
  }
  // Generic fallback for unmapped items
  if (unit in VOLUME_TO_ML) {
    return quantity * VOLUME_TO_ML[unit];
  }
  if (unit === "each" || unit === "medium" || unit === "large" || unit === "small") {
    if (foodRef?.gramsPerUnit.each) return quantity * foodRef.gramsPerUnit.each;
    return quantity * 100;
  }
  if (unit === "can") return quantity * 400;
  if (unit === "package" || unit === "bag" || unit === "box") return quantity * 300;
  if (unit === "bunch") return quantity * 100;
  if (unit === "clove") return quantity * 5;
  if (unit === "slice") return quantity * 30;
  return quantity * 50;
}

export function formatQuantity(qty: number | null): string {
  if (qty === null || !Number.isFinite(qty)) return "";
  const whole = Math.floor(qty);
  const rem = qty - whole;
  const fractions: [number, string][] = [
    [0.125, "⅛"],
    [0.25, "¼"],
    [0.333, "⅓"],
    [0.5, "½"],
    [0.667, "⅔"],
    [0.75, "¾"],
  ];
  for (const [val, sym] of fractions) {
    if (Math.abs(rem - val) < 0.04) {
      return whole > 0 ? `${whole} ${sym}` : sym;
    }
  }
  if (rem < 0.04) return String(whole);
  if (rem > 0.96) return String(whole + 1);
  return Number(qty.toFixed(2)).toString();
}
