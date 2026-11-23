import type { GroceryAisle, StorageLocation } from "./types";

export interface FoodReferenceEntry {
  canonicalName: string;
  aliases: string[];
  aisle: GroceryAisle;
  defaultLocation: StorageLocation;
  /** Grams per standard unit for macro/cost conversions */
  gramsPerUnit: Record<string, number>;
  /** USDA-derived nutrition per 100g */
  per100g: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    satFatG: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
    /** 0–100 percentage of fruits, vegetables, legumes, or nuts */
    fruitVegPct: number;
  };
  /** NOVA processing group: 1 = whole, 2 = culinary ingredient, 3 = processed, 4 = ultra-processed */
  novaGroup: 1 | 2 | 3 | 4;
  /** Baseline US grocery cost in cents per priceUnit */
  priceCents: number;
  priceUnit: string;
}

export const FOOD_DATABASE: FoodReferenceEntry[] = [
  // ==================== PRODUCE ====================
  {
    canonicalName: "yellow onion",
    aliases: ["onion", "onions", "sweet onion", "white onion", "vidalia onion", "brown onion"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 150, medium: 150, large: 220, small: 90, cup: 160, slice: 20 },
    per100g: { kcal: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1, satFatG: 0, fiberG: 1.7, sugarG: 4.2, sodiumMg: 4, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 85,
    priceUnit: "each",
  },
  {
    canonicalName: "red onion",
    aliases: ["purple onion", "red onions"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 150, medium: 150, cup: 160 },
    per100g: { kcal: 42, proteinG: 1.1, carbsG: 9.9, fatG: 0.1, satFatG: 0, fiberG: 1.7, sugarG: 4.2, sodiumMg: 4, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 110,
    priceUnit: "each",
  },
  {
    canonicalName: "shallot",
    aliases: ["shallots"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 45, tbsp: 10, cup: 160 },
    per100g: { kcal: 72, proteinG: 2.5, carbsG: 16.8, fatG: 0.1, satFatG: 0, fiberG: 3.2, sugarG: 7.9, sodiumMg: 12, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 75,
    priceUnit: "each",
  },
  {
    canonicalName: "green onion",
    aliases: ["green onions", "scallion", "scallions", "spring onion", "spring onions"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 15, stalk: 15, bunch: 100, cup: 100, tbsp: 6 },
    per100g: { kcal: 32, proteinG: 1.8, carbsG: 7.3, fatG: 0.2, satFatG: 0, fiberG: 2.6, sugarG: 2.3, sodiumMg: 16, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 129,
    priceUnit: "bunch",
  },
  {
    canonicalName: "garlic",
    aliases: ["garlic clove", "garlic cloves", "minced garlic", "fresh garlic", "head of garlic"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { clove: 5, tsp: 3, tbsp: 9, head: 50, each: 5 },
    per100g: { kcal: 149, proteinG: 6.4, carbsG: 33.1, fatG: 0.5, satFatG: 0.1, fiberG: 2.1, sugarG: 1, sodiumMg: 17, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 10,
    priceUnit: "clove",
  },
  {
    canonicalName: "ginger",
    aliases: ["fresh ginger", "ginger root", "grated ginger", "minced ginger"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { inch: 15, tbsp: 6, tsp: 2, each: 30 },
    per100g: { kcal: 80, proteinG: 1.8, carbsG: 17.8, fatG: 0.8, satFatG: 0.2, fiberG: 2, sugarG: 1.7, sodiumMg: 13, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 35,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "tomato",
    aliases: ["tomatoes", "roma tomato", "roma tomatoes", "vine tomato", "heirloom tomato", "plum tomato"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 130, medium: 130, large: 180, cup: 180 },
    per100g: { kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, satFatG: 0, fiberG: 1.2, sugarG: 2.6, sodiumMg: 5, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 90,
    priceUnit: "each",
  },
  {
    canonicalName: "cherry tomatoes",
    aliases: ["cherry tomato", "grape tomatoes", "grape tomato"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 150, pint: 300, package: 300, each: 17 },
    per100g: { kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2, satFatG: 0, fiberG: 1.2, sugarG: 2.6, sodiumMg: 5, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 349,
    priceUnit: "pint",
  },
  {
    canonicalName: "spinach",
    aliases: ["baby spinach", "fresh spinach", "spinach leaves"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 30, handful: 30, bag: 142, bunch: 250, oz: 28.35 },
    per100g: { kcal: 23, proteinG: 2.9, carbsG: 3.6, fatG: 0.4, satFatG: 0.1, fiberG: 2.2, sugarG: 0.4, sodiumMg: 79, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 349,
    priceUnit: "bag",
  },
  {
    canonicalName: "kale",
    aliases: ["lacinato kale", "tuscan kale", "curly kale", "baby kale"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 67, bunch: 250, bag: 142 },
    per100g: { kcal: 35, proteinG: 2.9, carbsG: 4.4, fatG: 1.5, satFatG: 0.2, fiberG: 4.1, sugarG: 1, sodiumMg: 53, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 279,
    priceUnit: "bunch",
  },
  {
    canonicalName: "broccoli",
    aliases: ["broccoli florets", "broccoli crown", "broccolini"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 91, head: 300, crown: 250, bunch: 250, each: 300 },
    per100g: { kcal: 34, proteinG: 2.8, carbsG: 6.6, fatG: 0.4, satFatG: 0, fiberG: 2.6, sugarG: 1.7, sodiumMg: 33, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 249,
    priceUnit: "head",
  },
  {
    canonicalName: "cauliflower",
    aliases: ["cauliflower florets", "cauliflower rice"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 107, head: 580, each: 580 },
    per100g: { kcal: 25, proteinG: 1.9, carbsG: 5, fatG: 0.3, satFatG: 0.1, fiberG: 2, sugarG: 1.9, sodiumMg: 30, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 349,
    priceUnit: "head",
  },
  {
    canonicalName: "carrot",
    aliases: ["carrots", "baby carrots", "shredded carrots"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 61, medium: 61, large: 75, cup: 128 },
    per100g: { kcal: 41, proteinG: 0.9, carbsG: 9.6, fatG: 0.2, satFatG: 0, fiberG: 2.8, sugarG: 4.7, sodiumMg: 69, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 30,
    priceUnit: "each",
  },
  {
    canonicalName: "celery",
    aliases: ["celery stalk", "celery stalks", "celery ribs", "celery rib"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { stalk: 40, rib: 40, each: 40, cup: 101, bunch: 450 },
    per100g: { kcal: 14, proteinG: 0.7, carbsG: 3, fatG: 0.2, satFatG: 0, fiberG: 1.6, sugarG: 1.3, sodiumMg: 80, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 25,
    priceUnit: "stalk",
  },
  {
    canonicalName: "bell pepper",
    aliases: ["red bell pepper", "green bell pepper", "yellow bell pepper", "orange bell pepper", "bell peppers", "sweet pepper"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 150, medium: 150, cup: 149 },
    per100g: { kcal: 31, proteinG: 1, carbsG: 6, fatG: 0.3, satFatG: 0, fiberG: 2.1, sugarG: 4.2, sodiumMg: 4, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 149,
    priceUnit: "each",
  },
  {
    canonicalName: "jalapeno",
    aliases: ["jalapeño", "jalapenos", "jalapeños", "jalapeno pepper", "serrano pepper", "chili pepper"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 14, tbsp: 10 },
    per100g: { kcal: 29, proteinG: 0.9, carbsG: 6.5, fatG: 0.4, satFatG: 0.1, fiberG: 2.8, sugarG: 4.1, sodiumMg: 3, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 35,
    priceUnit: "each",
  },
  {
    canonicalName: "zucchini",
    aliases: ["courgette", "yellow squash", "summer squash", "zucchinis"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 196, medium: 196, cup: 124 },
    per100g: { kcal: 17, proteinG: 1.2, carbsG: 3.1, fatG: 0.3, satFatG: 0.1, fiberG: 1, sugarG: 2.5, sodiumMg: 8, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 119,
    priceUnit: "each",
  },
  {
    canonicalName: "mushrooms",
    aliases: ["mushroom", "cremini mushrooms", "button mushrooms", "baby bella mushrooms", "shiitake mushrooms", "portobello"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 70, package: 227, oz: 28.35, lb: 453.6 },
    per100g: { kcal: 22, proteinG: 3.1, carbsG: 3.3, fatG: 0.3, satFatG: 0, fiberG: 1, sugarG: 2, sodiumMg: 5, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 299,
    priceUnit: "package",
  },
  {
    canonicalName: "potato",
    aliases: ["potatoes", "russet potato", "yukon gold potato", "yukon gold potatoes", "baby potatoes", "red potatoes"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 170, medium: 170, large: 280, cup: 150, lb: 453.6 },
    per100g: { kcal: 77, proteinG: 2, carbsG: 17.5, fatG: 0.1, satFatG: 0, fiberG: 2.2, sugarG: 0.8, sodiumMg: 6, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 129,
    priceUnit: "lb",
  },
  {
    canonicalName: "sweet potato",
    aliases: ["sweet potatoes", "yam", "yams"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 180, medium: 180, cup: 133, lb: 453.6 },
    per100g: { kcal: 86, proteinG: 1.6, carbsG: 20.1, fatG: 0.1, satFatG: 0, fiberG: 3, sugarG: 4.2, sodiumMg: 55, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 149,
    priceUnit: "lb",
  },
  {
    canonicalName: "avocado",
    aliases: ["avocados", "hass avocado"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 150, medium: 150, cup: 150 },
    per100g: { kcal: 160, proteinG: 2, carbsG: 8.5, fatG: 14.7, satFatG: 2.1, fiberG: 6.7, sugarG: 0.7, sodiumMg: 7, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 169,
    priceUnit: "each",
  },
  {
    canonicalName: "cucumber",
    aliases: ["cucumbers", "english cucumber", "persian cucumber", "persian cucumbers"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 200, cup: 119 },
    per100g: { kcal: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1, satFatG: 0, fiberG: 0.5, sugarG: 1.7, sodiumMg: 2, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 125,
    priceUnit: "each",
  },
  {
    canonicalName: "lettuce",
    aliases: ["romaine lettuce", "romaine", "mixed greens", "arugula", "butter lettuce", "spring mix"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 47, head: 350, bag: 142 },
    per100g: { kcal: 17, proteinG: 1.2, carbsG: 3.3, fatG: 0.3, satFatG: 0, fiberG: 2.1, sugarG: 1.2, sodiumMg: 8, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 299,
    priceUnit: "head",
  },
  {
    canonicalName: "cabbage",
    aliases: ["green cabbage", "red cabbage", "napa cabbage", "coleslaw mix"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 89, head: 900 },
    per100g: { kcal: 25, proteinG: 1.3, carbsG: 5.8, fatG: 0.1, satFatG: 0, fiberG: 2.5, sugarG: 3.2, sodiumMg: 18, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 249,
    priceUnit: "head",
  },
  {
    canonicalName: "asparagus",
    aliases: ["asparagus spears"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { bunch: 450, spear: 16, lb: 453.6 },
    per100g: { kcal: 20, proteinG: 2.2, carbsG: 3.9, fatG: 0.1, satFatG: 0, fiberG: 2.1, sugarG: 1.9, sodiumMg: 2, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 399,
    priceUnit: "bunch",
  },
  {
    canonicalName: "green beans",
    aliases: ["string beans", "french green beans", "haricots verts"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 100, lb: 453.6, bag: 340 },
    per100g: { kcal: 31, proteinG: 1.8, carbsG: 7, fatG: 0.2, satFatG: 0, fiberG: 2.7, sugarG: 3.3, sodiumMg: 6, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 299,
    priceUnit: "lb",
  },
  {
    canonicalName: "lemon",
    aliases: ["lemons", "lemon juice", "fresh lemon juice", "lemon zest"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 58, tbsp: 15, tsp: 5, cup: 244 },
    per100g: { kcal: 29, proteinG: 1.1, carbsG: 9.3, fatG: 0.3, satFatG: 0, fiberG: 2.8, sugarG: 2.5, sodiumMg: 2, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 75,
    priceUnit: "each",
  },
  {
    canonicalName: "lime",
    aliases: ["limes", "lime juice", "fresh lime juice", "lime zest"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 44, tbsp: 15, tsp: 5, cup: 244 },
    per100g: { kcal: 30, proteinG: 0.7, carbsG: 10.5, fatG: 0.2, satFatG: 0, fiberG: 2.8, sugarG: 1.7, sodiumMg: 2, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 55,
    priceUnit: "each",
  },
  {
    canonicalName: "cilantro",
    aliases: ["fresh cilantro", "coriander leaves", "cilantro leaves"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { bunch: 60, cup: 16, tbsp: 4 },
    per100g: { kcal: 23, proteinG: 2.1, carbsG: 3.7, fatG: 0.5, satFatG: 0, fiberG: 2.8, sugarG: 0.9, sodiumMg: 46, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 119,
    priceUnit: "bunch",
  },
  {
    canonicalName: "parsley",
    aliases: ["fresh parsley", "flat-leaf parsley", "italian parsley", "curly parsley"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { bunch: 60, cup: 60, tbsp: 4 },
    per100g: { kcal: 36, proteinG: 3, carbsG: 6.3, fatG: 0.8, satFatG: 0.1, fiberG: 3.3, sugarG: 0.9, sodiumMg: 56, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 149,
    priceUnit: "bunch",
  },
  {
    canonicalName: "basil",
    aliases: ["fresh basil", "basil leaves", "sweet basil", "thai basil"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { bunch: 40, cup: 24, tbsp: 3, package: 21 },
    per100g: { kcal: 23, proteinG: 3.2, carbsG: 2.7, fatG: 0.6, satFatG: 0, fiberG: 1.6, sugarG: 0.3, sodiumMg: 4, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 249,
    priceUnit: "package",
  },
  {
    canonicalName: "banana",
    aliases: ["bananas", "ripe banana", "ripe bananas"],
    aisle: "Produce",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 118, medium: 118, cup: 150 },
    per100g: { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, satFatG: 0.1, fiberG: 2.6, sugarG: 12.2, sodiumMg: 1, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 30,
    priceUnit: "each",
  },
  {
    canonicalName: "berries",
    aliases: ["blueberries", "strawberries", "raspberries", "blackberries", "mixed berries"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 148, pint: 280, package: 170 },
    per100g: { kcal: 50, proteinG: 0.8, carbsG: 12.2, fatG: 0.3, satFatG: 0, fiberG: 2.6, sugarG: 8, sodiumMg: 1, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 399,
    priceUnit: "package",
  },
  {
    canonicalName: "apple",
    aliases: ["apples", "honeycrisp apple", "granny smith apple", "fuji apple"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 182, medium: 182, cup: 125 },
    per100g: { kcal: 52, proteinG: 0.3, carbsG: 13.8, fatG: 0.2, satFatG: 0, fiberG: 2.4, sugarG: 10.4, sodiumMg: 1, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 110,
    priceUnit: "each",
  },

  // ==================== MEAT & SEAFOOD ====================
  {
    canonicalName: "chicken breast",
    aliases: ["chicken breasts", "boneless skinless chicken breast", "boneless skinless chicken breasts", "chicken tenderloins", "chicken"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { lb: 453.6, oz: 28.35, each: 200, breast: 200 },
    per100g: { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, satFatG: 1, fiberG: 0, sugarG: 0, sodiumMg: 74, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 499,
    priceUnit: "lb",
  },
  {
    canonicalName: "chicken thigh",
    aliases: ["chicken thighs", "boneless skinless chicken thighs", "bone-in chicken thighs"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { lb: 453.6, oz: 28.35, each: 140, thigh: 140 },
    per100g: { kcal: 177, proteinG: 24.8, carbsG: 0, fatG: 8.2, satFatG: 2.2, fiberG: 0, sugarG: 0, sodiumMg: 84, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 379,
    priceUnit: "lb",
  },
  {
    canonicalName: "ground beef",
    aliases: ["lean ground beef", "beef", "ground chuck", "ground sirloin"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { lb: 453.6, oz: 28.35 },
    per100g: { kcal: 215, proteinG: 26, carbsG: 0, fatG: 11.8, satFatG: 4.7, fiberG: 0, sugarG: 0, sodiumMg: 72, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 649,
    priceUnit: "lb",
  },
  {
    canonicalName: "ground turkey",
    aliases: ["lean ground turkey", "turkey"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { lb: 453.6, oz: 28.35 },
    per100g: { kcal: 170, proteinG: 27, carbsG: 0, fatG: 7, satFatG: 1.9, fiberG: 0, sugarG: 0, sodiumMg: 88, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 549,
    priceUnit: "lb",
  },
  {
    canonicalName: "steak",
    aliases: ["flank steak", "sirloin steak", "ribeye", "beef steak", "skirt steak"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { lb: 453.6, oz: 28.35, each: 225 },
    per100g: { kcal: 210, proteinG: 27.5, carbsG: 0, fatG: 10.5, satFatG: 4.1, fiberG: 0, sugarG: 0, sodiumMg: 60, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 1199,
    priceUnit: "lb",
  },
  {
    canonicalName: "salmon",
    aliases: ["salmon fillet", "salmon fillets", "atlantic salmon", "wild salmon", "sockeye salmon"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { lb: 453.6, oz: 28.35, fillet: 170, each: 170 },
    per100g: { kcal: 208, proteinG: 20.4, carbsG: 0, fatG: 13.4, satFatG: 3.1, fiberG: 0, sugarG: 0, sodiumMg: 59, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 1199,
    priceUnit: "lb",
  },
  {
    canonicalName: "shrimp",
    aliases: ["prawns", "raw shrimp", "large shrimp", "peeled shrimp"],
    aisle: "Meat & Seafood",
    defaultLocation: "freezer",
    gramsPerUnit: { lb: 453.6, oz: 28.35, each: 15 },
    per100g: { kcal: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, satFatG: 0.1, fiberG: 0, sugarG: 0, sodiumMg: 111, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 999,
    priceUnit: "lb",
  },
  {
    canonicalName: "bacon",
    aliases: ["thick-cut bacon", "turkey bacon", "pancetta", "bacon strips"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { slice: 28, strip: 28, lb: 453.6, oz: 28.35 },
    per100g: { kcal: 417, proteinG: 13, carbsG: 1.4, fatG: 40, satFatG: 13.5, fiberG: 0, sugarG: 0, sodiumMg: 1375, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 699,
    priceUnit: "lb",
  },
  {
    canonicalName: "sausage",
    aliases: ["italian sausage", "chicken sausage", "pork sausage", "chorizo", "andouille sausage"],
    aisle: "Meat & Seafood",
    defaultLocation: "fridge",
    gramsPerUnit: { lb: 453.6, oz: 28.35, link: 90, each: 90 },
    per100g: { kcal: 290, proteinG: 16, carbsG: 2, fatG: 24, satFatG: 8.5, fiberG: 0, sugarG: 1, sodiumMg: 820, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 599,
    priceUnit: "lb",
  },
  {
    canonicalName: "tofu",
    aliases: ["firm tofu", "extra firm tofu", "extra-firm tofu", "silken tofu"],
    aisle: "Produce",
    defaultLocation: "fridge",
    gramsPerUnit: { block: 396, package: 396, oz: 28.35, cup: 252 },
    per100g: { kcal: 94, proteinG: 10, carbsG: 2.3, fatG: 5.3, satFatG: 0.8, fiberG: 1.2, sugarG: 0.6, sodiumMg: 12, fruitVegPct: 80 },
    novaGroup: 1,
    priceCents: 279,
    priceUnit: "block",
  },

  // ==================== DAIRY & EGGS ====================
  {
    canonicalName: "eggs",
    aliases: ["egg", "large egg", "large eggs", "egg yolk", "egg white"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { each: 50, large: 50, dozen: 600 },
    per100g: { kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5, satFatG: 3.1, fiberG: 0, sugarG: 0.4, sodiumMg: 142, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 38,
    priceUnit: "each",
  },
  {
    canonicalName: "butter",
    aliases: ["unsalted butter", "salted butter", "melted butter", "cold butter"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { tbsp: 14.2, tsp: 4.7, stick: 113, cup: 227, oz: 28.35 },
    per100g: { kcal: 717, proteinG: 0.9, carbsG: 0.1, fatG: 81.1, satFatG: 51.4, fiberG: 0, sugarG: 0.1, sodiumMg: 11, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 18,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "milk",
    aliases: ["whole milk", "2% milk", "skim milk", "almond milk", "oat milk", "buttermilk"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 244, tbsp: 15, ml: 1 },
    per100g: { kcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3, satFatG: 1.9, fiberG: 0, sugarG: 5, sodiumMg: 43, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 28,
    priceUnit: "cup",
  },
  {
    canonicalName: "heavy cream",
    aliases: ["heavy whipping cream", "whipping cream", "half and half", "half-and-half", "double cream"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 238, tbsp: 15, ml: 1 },
    per100g: { kcal: 340, proteinG: 2.8, carbsG: 2.7, fatG: 36.1, satFatG: 23, fiberG: 0, sugarG: 2.9, sodiumMg: 27, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 150,
    priceUnit: "cup",
  },
  {
    canonicalName: "greek yogurt",
    aliases: ["plain greek yogurt", "yogurt", "plain yogurt", "sour cream"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 245, tbsp: 15, oz: 28.35 },
    per100g: { kcal: 73, proteinG: 10, carbsG: 3.9, fatG: 1.9, satFatG: 1.2, fiberG: 0, sugarG: 3.6, sodiumMg: 36, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 145,
    priceUnit: "cup",
  },
  {
    canonicalName: "parmesan",
    aliases: ["parmesan cheese", "parmigiano reggiano", "grated parmesan", "shaved parmesan", "pecorino"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 100, tbsp: 6, oz: 28.35 },
    per100g: { kcal: 431, proteinG: 38.5, carbsG: 4.1, fatG: 28.6, satFatG: 17.3, fiberG: 0, sugarG: 0.9, sodiumMg: 1529, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 220,
    priceUnit: "cup",
  },
  {
    canonicalName: "mozzarella",
    aliases: ["mozzarella cheese", "fresh mozzarella", "shredded mozzarella", "burrata"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 112, oz: 28.35, ball: 226 },
    per100g: { kcal: 280, proteinG: 27.5, carbsG: 3.1, fatG: 17.1, satFatG: 10.9, fiberG: 0, sugarG: 1, sodiumMg: 627, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 160,
    priceUnit: "cup",
  },
  {
    canonicalName: "cheddar cheese",
    aliases: ["cheddar", "shredded cheddar", "sharp cheddar", "monterey jack", "shredded cheese", "mexican blend cheese"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 113, oz: 28.35, slice: 28 },
    per100g: { kcal: 403, proteinG: 24.9, carbsG: 1.3, fatG: 33.1, satFatG: 21.1, fiberG: 0, sugarG: 0.5, sodiumMg: 621, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 150,
    priceUnit: "cup",
  },
  {
    canonicalName: "feta cheese",
    aliases: ["feta", "crumbled feta", "goat cheese"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 150, oz: 28.35, tbsp: 10 },
    per100g: { kcal: 264, proteinG: 14.2, carbsG: 4.1, fatG: 21.3, satFatG: 14.9, fiberG: 0, sugarG: 4.1, sodiumMg: 1116, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 250,
    priceUnit: "cup",
  },
  {
    canonicalName: "cream cheese",
    aliases: ["softened cream cheese", "ricotta", "ricotta cheese", "cottage cheese"],
    aisle: "Dairy & Eggs",
    defaultLocation: "fridge",
    gramsPerUnit: { oz: 28.35, tbsp: 14.5, cup: 232, block: 226 },
    per100g: { kcal: 342, proteinG: 5.9, carbsG: 4.1, fatG: 34.2, satFatG: 19.3, fiberG: 0, sugarG: 3.2, sodiumMg: 321, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 45,
    priceUnit: "oz",
  },

  // ==================== PANTRY & GRAINS ====================
  {
    canonicalName: "pasta",
    aliases: ["spaghetti", "penne", "rigatoni", "fettuccine", "linguine", "macaroni", "orzo", "rotini", "fusilli", "noodles", "ramen noodles"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { lb: 453.6, oz: 28.35, cup: 100, package: 454, box: 454 },
    per100g: { kcal: 371, proteinG: 13, carbsG: 74.7, fatG: 1.5, satFatG: 0.3, fiberG: 3.2, sugarG: 2.7, sodiumMg: 6, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 199,
    priceUnit: "lb",
  },
  {
    canonicalName: "rice",
    aliases: ["white rice", "jasmine rice", "basmati rice", "brown rice", "arborio rice", "sushi rice", "long grain rice"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 185, lb: 453.6, oz: 28.35 },
    per100g: { kcal: 365, proteinG: 7.1, carbsG: 80, fatG: 0.7, satFatG: 0.2, fiberG: 1.3, sugarG: 0.1, sodiumMg: 5, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 75,
    priceUnit: "cup",
  },
  {
    canonicalName: "quinoa",
    aliases: ["tri-color quinoa", "white quinoa", "cooked quinoa"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 170, lb: 453.6 },
    per100g: { kcal: 368, proteinG: 14.1, carbsG: 64.2, fatG: 6.1, satFatG: 0.7, fiberG: 7, sugarG: 0, sodiumMg: 5, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 150,
    priceUnit: "cup",
  },
  {
    canonicalName: "oats",
    aliases: ["rolled oats", "old-fashioned oats", "old fashioned oats", "quick oats", "steel cut oats"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 81, tbsp: 5 },
    per100g: { kcal: 389, proteinG: 16.9, carbsG: 66.3, fatG: 6.9, satFatG: 1.2, fiberG: 10.6, sugarG: 0, sodiumMg: 2, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 45,
    priceUnit: "cup",
  },
  {
    canonicalName: "all-purpose flour",
    aliases: ["flour", "ap flour", "whole wheat flour", "bread flour", "almond flour"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 120, tbsp: 8, tsp: 2.6 },
    per100g: { kcal: 364, proteinG: 10.3, carbsG: 76.3, fatG: 1, satFatG: 0.2, fiberG: 2.7, sugarG: 0.3, sodiumMg: 2, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 25,
    priceUnit: "cup",
  },
  {
    canonicalName: "cornstarch",
    aliases: ["corn starch", "arrowroot", "tapioca starch"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { tbsp: 8, tsp: 2.7, cup: 128 },
    per100g: { kcal: 381, proteinG: 0.3, carbsG: 91.3, fatG: 0.1, satFatG: 0, fiberG: 0.9, sugarG: 0, sodiumMg: 9, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 12,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "breadcrumbs",
    aliases: ["panko", "panko breadcrumbs", "bread crumbs", "italian breadcrumbs"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 60, tbsp: 4 },
    per100g: { kcal: 395, proteinG: 13.4, carbsG: 72, fatG: 5.3, satFatG: 1.2, fiberG: 4.5, sugarG: 6.2, sodiumMg: 732, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 75,
    priceUnit: "cup",
  },
  {
    canonicalName: "sugar",
    aliases: ["granulated sugar", "white sugar", "brown sugar", "light brown sugar", "dark brown sugar", "powdered sugar"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 200, tbsp: 12.5, tsp: 4.2 },
    per100g: { kcal: 387, proteinG: 0, carbsG: 100, fatG: 0, satFatG: 0, fiberG: 0, sugarG: 99.8, sodiumMg: 1, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 8,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "honey",
    aliases: ["raw honey", "maple syrup", "pure maple syrup", "agave"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { tbsp: 21, tsp: 7, cup: 339 },
    per100g: { kcal: 304, proteinG: 0.3, carbsG: 82.4, fatG: 0, satFatG: 0, fiberG: 0.2, sugarG: 82.1, sodiumMg: 4, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 45,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "peanut butter",
    aliases: ["almond butter", "tahini", "creamy peanut butter"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { tbsp: 16, tsp: 5.3, cup: 258 },
    per100g: { kcal: 588, proteinG: 25, carbsG: 20, fatG: 50, satFatG: 10, fiberG: 6, sugarG: 9, sodiumMg: 429, fruitVegPct: 90 },
    novaGroup: 3,
    priceCents: 28,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "nuts",
    aliases: ["almonds", "walnuts", "pecans", "cashews", "pine nuts", "peanuts", "pistachios"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 140, tbsp: 9, oz: 28.35 },
    per100g: { kcal: 600, proteinG: 20, carbsG: 20, fatG: 52, satFatG: 6, fiberG: 9, sugarG: 4, sodiumMg: 5, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 240,
    priceUnit: "cup",
  },
  {
    canonicalName: "lentils",
    aliases: ["red lentils", "green lentils", "brown lentils", "french lentils"],
    aisle: "Pantry & Grains",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 192, lb: 453.6 },
    per100g: { kcal: 352, proteinG: 24.6, carbsG: 63.4, fatG: 1.1, satFatG: 0.2, fiberG: 10.7, sugarG: 2, sodiumMg: 6, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 95,
    priceUnit: "cup",
  },

  // ==================== CANNED & JARRED ====================
  {
    canonicalName: "diced tomatoes",
    aliases: ["crushed tomatoes", "canned tomatoes", "whole peeled tomatoes", "san marzano tomatoes", "fire roasted tomatoes", "tomato sauce", "marinara sauce"],
    aisle: "Canned & Jarred",
    defaultLocation: "pantry",
    gramsPerUnit: { can: 411, cup: 240, oz: 28.35 },
    per100g: { kcal: 32, proteinG: 1.6, carbsG: 7.3, fatG: 0.3, satFatG: 0, fiberG: 1.9, sugarG: 4.4, sodiumMg: 220, fruitVegPct: 95 },
    novaGroup: 3,
    priceCents: 189,
    priceUnit: "can",
  },
  {
    canonicalName: "tomato paste",
    aliases: ["double concentrated tomato paste"],
    aisle: "Canned & Jarred",
    defaultLocation: "pantry",
    gramsPerUnit: { tbsp: 16, tsp: 5.3, can: 170, oz: 28.35 },
    per100g: { kcal: 82, proteinG: 4.3, carbsG: 18.9, fatG: 0.5, satFatG: 0.1, fiberG: 4.1, sugarG: 12.2, sodiumMg: 59, fruitVegPct: 100 },
    novaGroup: 3,
    priceCents: 25,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "chickpeas",
    aliases: ["garbanzo beans", "canned chickpeas"],
    aisle: "Canned & Jarred",
    defaultLocation: "pantry",
    gramsPerUnit: { can: 425, cup: 164, oz: 28.35 },
    per100g: { kcal: 139, proteinG: 7, carbsG: 22.5, fatG: 2.6, satFatG: 0.3, fiberG: 6.4, sugarG: 3.8, sodiumMg: 240, fruitVegPct: 100 },
    novaGroup: 3,
    priceCents: 139,
    priceUnit: "can",
  },
  {
    canonicalName: "black beans",
    aliases: ["canned black beans", "kidney beans", "cannellini beans", "white beans", "pinto beans"],
    aisle: "Canned & Jarred",
    defaultLocation: "pantry",
    gramsPerUnit: { can: 425, cup: 172, oz: 28.35 },
    per100g: { kcal: 114, proteinG: 7.6, carbsG: 20, fatG: 0.5, satFatG: 0.1, fiberG: 7.5, sugarG: 0.3, sodiumMg: 240, fruitVegPct: 100 },
    novaGroup: 3,
    priceCents: 139,
    priceUnit: "can",
  },
  {
    canonicalName: "coconut milk",
    aliases: ["full-fat coconut milk", "light coconut milk", "canned coconut milk", "coconut cream"],
    aisle: "Canned & Jarred",
    defaultLocation: "pantry",
    gramsPerUnit: { can: 400, cup: 240, tbsp: 15 },
    per100g: { kcal: 197, proteinG: 2, carbsG: 2.8, fatG: 21.3, satFatG: 18.9, fiberG: 0, sugarG: 2.1, sodiumMg: 13, fruitVegPct: 60 },
    novaGroup: 3,
    priceCents: 249,
    priceUnit: "can",
  },
  {
    canonicalName: "chicken broth",
    aliases: ["chicken stock", "vegetable broth", "vegetable stock", "beef broth", "beef stock", "bone broth", "broth", "stock"],
    aisle: "Canned & Jarred",
    defaultLocation: "pantry",
    gramsPerUnit: { cup: 240, can: 411, carton: 946, tbsp: 15, ml: 1 },
    per100g: { kcal: 15, proteinG: 1.5, carbsG: 1, fatG: 0.5, satFatG: 0.1, fiberG: 0, sugarG: 0.5, sodiumMg: 340, fruitVegPct: 10 },
    novaGroup: 3,
    priceCents: 75,
    priceUnit: "cup",
  },
  {
    canonicalName: "salsa",
    aliases: ["pico de gallo", "salsa verde", "enchilada sauce"],
    aisle: "Canned & Jarred",
    defaultLocation: "fridge",
    gramsPerUnit: { cup: 260, tbsp: 16, jar: 454 },
    per100g: { kcal: 29, proteinG: 1.4, carbsG: 6.4, fatG: 0.2, satFatG: 0, fiberG: 1.4, sugarG: 4, sodiumMg: 430, fruitVegPct: 90 },
    novaGroup: 3,
    priceCents: 180,
    priceUnit: "cup",
  },
  {
    canonicalName: "pesto",
    aliases: ["basil pesto", "green pesto"],
    aisle: "Canned & Jarred",
    defaultLocation: "fridge",
    gramsPerUnit: { tbsp: 15, cup: 230, jar: 190 },
    per100g: { kcal: 420, proteinG: 6, carbsG: 7, fatG: 40, satFatG: 6, fiberG: 2, sugarG: 2, sodiumMg: 780, fruitVegPct: 40 },
    novaGroup: 3,
    priceCents: 45,
    priceUnit: "tbsp",
  },

  // ==================== SPICES, OILS & CONDIMENTS ====================
  {
    canonicalName: "olive oil",
    aliases: ["extra virgin olive oil", "extra-virgin olive oil", "evoo", "avocado oil", "vegetable oil", "canola oil", "cooking oil"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tbsp: 13.5, tsp: 4.5, cup: 216, ml: 0.92 },
    per100g: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, satFatG: 13.8, fiberG: 0, sugarG: 0, sodiumMg: 2, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 22,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "sesame oil",
    aliases: ["toasted sesame oil"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tbsp: 13.6, tsp: 4.5 },
    per100g: { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100, satFatG: 14.2, fiberG: 0, sugarG: 0, sodiumMg: 0, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 30,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "soy sauce",
    aliases: ["low sodium soy sauce", "low-sodium soy sauce", "tamari", "coconut aminos"],
    aisle: "Spices & Oils",
    defaultLocation: "pantry",
    gramsPerUnit: { tbsp: 16, tsp: 5.3, cup: 255 },
    per100g: { kcal: 53, proteinG: 8.1, carbsG: 4.9, fatG: 0.6, satFatG: 0.1, fiberG: 0.8, sugarG: 0.4, sodiumMg: 5493, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 18,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "vinegar",
    aliases: ["apple cider vinegar", "balsamic vinegar", "red wine vinegar", "white wine vinegar", "rice vinegar"],
    aisle: "Spices & Oils",
    defaultLocation: "pantry",
    gramsPerUnit: { tbsp: 15, tsp: 5, cup: 240 },
    per100g: { kcal: 21, proteinG: 0, carbsG: 0.9, fatG: 0, satFatG: 0, fiberG: 0, sugarG: 0.4, sodiumMg: 5, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 15,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "dijon mustard",
    aliases: ["mustard", "whole grain mustard", "yellow mustard"],
    aisle: "Spices & Oils",
    defaultLocation: "fridge",
    gramsPerUnit: { tbsp: 15, tsp: 5 },
    per100g: { kcal: 66, proteinG: 4.4, carbsG: 5.3, fatG: 3.3, satFatG: 0.2, fiberG: 4, sugarG: 0.9, sodiumMg: 1135, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 18,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "mayonnaise",
    aliases: ["mayo", "greek yogurt mayo"],
    aisle: "Spices & Oils",
    defaultLocation: "fridge",
    gramsPerUnit: { tbsp: 14, tsp: 4.7, cup: 220 },
    per100g: { kcal: 680, proteinG: 1, carbsG: 0.6, fatG: 75, satFatG: 11.7, fiberG: 0, sugarG: 0.6, sodiumMg: 635, fruitVegPct: 0 },
    novaGroup: 4,
    priceCents: 20,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "hot sauce",
    aliases: ["sriracha", "chili crisp", "sambal oelek", "gochujang", "buffalo sauce"],
    aisle: "Spices & Oils",
    defaultLocation: "fridge",
    gramsPerUnit: { tbsp: 15, tsp: 5 },
    per100g: { kcal: 93, proteinG: 2, carbsG: 19, fatG: 0.9, satFatG: 0.1, fiberG: 2, sugarG: 14, sodiumMg: 2000, fruitVegPct: 30 },
    novaGroup: 4,
    priceCents: 20,
    priceUnit: "tbsp",
  },
  {
    canonicalName: "salt",
    aliases: ["kosher salt", "sea salt", "flaky sea salt", "table salt", "fine sea salt", "salt and pepper"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tsp: 6, tbsp: 18, pinch: 0.5 },
    per100g: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, satFatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 38758, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 3,
    priceUnit: "tsp",
  },
  {
    canonicalName: "black pepper",
    aliases: ["pepper", "ground black pepper", "freshly cracked black pepper", "cracked black pepper"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tsp: 2.3, tbsp: 6.9, pinch: 0.3 },
    per100g: { kcal: 251, proteinG: 10.4, carbsG: 64, fatG: 3.3, satFatG: 1.4, fiberG: 25.3, sugarG: 0.6, sodiumMg: 20, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 8,
    priceUnit: "tsp",
  },
  {
    canonicalName: "paprika",
    aliases: ["smoked paprika", "sweet paprika"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tsp: 2.3, tbsp: 6.8 },
    per100g: { kcal: 282, proteinG: 14.1, carbsG: 53.9, fatG: 12.9, satFatG: 2.1, fiberG: 34.9, sugarG: 10.3, sodiumMg: 68, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 12,
    priceUnit: "tsp",
  },
  {
    canonicalName: "cumin",
    aliases: ["ground cumin", "cumin seeds"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tsp: 2.1, tbsp: 6 },
    per100g: { kcal: 375, proteinG: 17.8, carbsG: 44.2, fatG: 22.3, satFatG: 1.5, fiberG: 10.5, sugarG: 2.3, sodiumMg: 168, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 12,
    priceUnit: "tsp",
  },
  {
    canonicalName: "chili powder",
    aliases: ["red pepper flakes", "crushed red pepper", "cayenne", "cayenne pepper", "chili flakes"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tsp: 2.6, tbsp: 8, pinch: 0.4 },
    per100g: { kcal: 282, proteinG: 13.5, carbsG: 49.7, fatG: 14.3, satFatG: 2.5, fiberG: 34.8, sugarG: 7.2, sodiumMg: 2867, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 12,
    priceUnit: "tsp",
  },
  {
    canonicalName: "italian seasoning",
    aliases: ["dried oregano", "oregano", "dried thyme", "thyme", "dried basil", "rosemary", "garlic powder", "onion powder", "curry powder", "garam masala", "turmeric", "cinnamon"],
    aisle: "Spices & Oils",
    defaultLocation: "spices",
    gramsPerUnit: { tsp: 2, tbsp: 6 },
    per100g: { kcal: 265, proteinG: 9, carbsG: 65, fatG: 4, satFatG: 1, fiberG: 30, sugarG: 4, sodiumMg: 40, fruitVegPct: 0 },
    novaGroup: 1,
    priceCents: 12,
    priceUnit: "tsp",
  },
  {
    canonicalName: "baking powder",
    aliases: ["baking soda", "vanilla extract", "vanilla"],
    aisle: "Spices & Oils",
    defaultLocation: "pantry",
    gramsPerUnit: { tsp: 4.6, tbsp: 13.8 },
    per100g: { kcal: 53, proteinG: 0, carbsG: 27.7, fatG: 0, satFatG: 0, fiberG: 0.2, sugarG: 0, sodiumMg: 10600, fruitVegPct: 0 },
    novaGroup: 2,
    priceCents: 10,
    priceUnit: "tsp",
  },

  // ==================== BAKERY & FROZEN ====================
  {
    canonicalName: "bread",
    aliases: ["sourdough bread", "sourdough", "baguette", "ciabatta", "brioche", "whole wheat bread", "sandwich bread", "toast"],
    aisle: "Bakery",
    defaultLocation: "pantry",
    gramsPerUnit: { slice: 35, loaf: 450, each: 35 },
    per100g: { kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2, satFatG: 0.7, fiberG: 2.7, sugarG: 5, sodiumMg: 491, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 35,
    priceUnit: "slice",
  },
  {
    canonicalName: "tortillas",
    aliases: ["tortilla", "flour tortillas", "corn tortillas", "taco shells", "naan", "pita", "pita bread"],
    aisle: "Bakery",
    defaultLocation: "pantry",
    gramsPerUnit: { each: 45, package: 360 },
    per100g: { kcal: 290, proteinG: 8, carbsG: 50, fatG: 7, satFatG: 2, fiberG: 3.5, sugarG: 2, sodiumMg: 560, fruitVegPct: 0 },
    novaGroup: 3,
    priceCents: 45,
    priceUnit: "each",
  },
  {
    canonicalName: "frozen peas",
    aliases: ["peas", "green peas", "frozen corn", "corn", "sweet corn", "edamame", "frozen spinach", "frozen berries"],
    aisle: "Frozen",
    defaultLocation: "freezer",
    gramsPerUnit: { cup: 145, bag: 340, oz: 28.35 },
    per100g: { kcal: 77, proteinG: 5.2, carbsG: 13.7, fatG: 0.4, satFatG: 0.1, fiberG: 4.5, sugarG: 5, sodiumMg: 108, fruitVegPct: 100 },
    novaGroup: 1,
    priceCents: 95,
    priceUnit: "cup",
  },
];

// Build fast lookup maps
const aliasIndex = new Map<string, FoodReferenceEntry>();

for (const entry of FOOD_DATABASE) {
  aliasIndex.set(entry.canonicalName.toLowerCase(), entry);
  for (const alias of entry.aliases) {
    aliasIndex.set(alias.toLowerCase(), entry);
  }
}

const PREP_WORDS = new Set([
  "fresh",
  "freshly",
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
  "lightly",
  "packed",
  "room",
  "temperature",
  "large",
  "medium",
  "small",
  "ripe",
  "organic",
  "boneless",
  "skinless",
  "cold",
  "warm",
  "hot",
  "to",
  "taste",
  "for",
  "serving",
  "garnish",
]);

export function cleanIngredientName(raw: string): string {
  const withoutParens = raw.replace(/\([^)]*\)/g, " ");
  const beforeComma = withoutParens.split(",")[0] ?? withoutParens;
  const cleaned = beforeComma
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

export function stripPrepWords(cleaned: string): string {
  const tokens = cleaned.split(" ").filter((t) => t && !PREP_WORDS.has(t));
  return tokens.join(" ").trim() || cleaned;
}

export function lookupFoodReference(rawName: string): FoodReferenceEntry | null {
  const cleaned = cleanIngredientName(rawName);
  if (!cleaned) return null;

  // 1. Exact alias match
  const exact = aliasIndex.get(cleaned);
  if (exact) return exact;

  // 2. Stripped prep words match
  const stripped = stripPrepWords(cleaned);
  const strippedMatch = aliasIndex.get(stripped);
  if (strippedMatch) return strippedMatch;

  // 3. Singularize simple plural
  if (stripped.endsWith("es")) {
    const m = aliasIndex.get(stripped.slice(0, -2));
    if (m) return m;
  }
  if (stripped.endsWith("s")) {
    const m = aliasIndex.get(stripped.slice(0, -1));
    if (m) return m;
  }

  // 4. Longest alias contained as a phrase inside stripped name
  let bestMatch: FoodReferenceEntry | null = null;
  let bestLen = 0;
  for (const [alias, entry] of aliasIndex.entries()) {
    if (alias.length < 3) continue;
    const pattern = new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
    if (pattern.test(stripped) && alias.length > bestLen) {
      bestMatch = entry;
      bestLen = alias.length;
    }
  }
  return bestMatch;
}

export function canonicalizeIngredientName(rawName: string): string {
  const ref = lookupFoodReference(rawName);
  if (ref) return ref.canonicalName;
  const stripped = stripPrepWords(cleanIngredientName(rawName));
  return stripped || rawName.trim().toLowerCase();
}

export function guessAisle(rawName: string): GroceryAisle {
  const ref = lookupFoodReference(rawName);
  if (ref) return ref.aisle;
  const lower = rawName.toLowerCase();
  if (/chicken|beef|pork|turkey|fish|salmon|shrimp|steak|sausage|bacon/.test(lower)) return "Meat & Seafood";
  if (/milk|cheese|yogurt|cream|butter|egg/.test(lower)) return "Dairy & Eggs";
  if (/frozen/.test(lower)) return "Frozen";
  if (/bread|bun|roll|tortilla|pita|naan|bagel/.test(lower)) return "Bakery";
  if (/oil|vinegar|salt|pepper|spice|powder|seasoning|sauce|mustard|herb/.test(lower)) return "Spices & Oils";
  if (/can |canned|jar|broth|stock|bean|tomato paste/.test(lower)) return "Canned & Jarred";
  if (/lettuce|spinach|onion|garlic|tomato|pepper|berry|apple|banana|lemon|lime|herb|carrot|celery/.test(lower)) return "Produce";
  return "Pantry & Grains";
}

export function guessStorageLocation(rawName: string): StorageLocation {
  const ref = lookupFoodReference(rawName);
  if (ref) return ref.defaultLocation;
  const aisle = guessAisle(rawName);
  switch (aisle) {
    case "Dairy & Eggs":
    case "Meat & Seafood":
    case "Produce":
      return "fridge";
    case "Frozen":
      return "freezer";
    case "Spices & Oils":
      return "spices";
    default:
      return "pantry";
  }
}

export function searchFoodReference(query: string, limit = 10): FoodReferenceEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOOD_DATABASE.slice(0, limit);
  const scored: { entry: FoodReferenceEntry; rank: number }[] = [];
  for (const entry of FOOD_DATABASE) {
    if (entry.canonicalName.startsWith(q)) {
      scored.push({ entry, rank: 0 });
    } else if (entry.canonicalName.includes(q)) {
      scored.push({ entry, rank: 1 });
    } else if (entry.aliases.some((a) => a.toLowerCase().includes(q))) {
      scored.push({ entry, rank: 2 });
    }
  }
  scored.sort((a, b) => a.rank - b.rank || a.entry.canonicalName.localeCompare(b.entry.canonicalName));
  return scored.slice(0, limit).map((s) => s.entry);
}
