export type NutritionGrade = "excellent" | "good" | "mediocre" | "poor";

export type StorageLocation = "fridge" | "freezer" | "pantry" | "spices";

export type StockStatus = "in_stock" | "low" | "out";

export type GroceryAisle =
  | "Produce"
  | "Meat & Seafood"
  | "Dairy & Eggs"
  | "Pantry & Grains"
  | "Canned & Jarred"
  | "Spices & Oils"
  | "Frozen"
  | "Bakery"
  | "Other";

export interface NutritionMacros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  saturatedFatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

export interface NutritionContributor {
  name: string;
  impact: "positive" | "negative" | "neutral";
  detail: string;
}

export interface NutritionBreakdown {
  score: number;
  grade: NutritionGrade;
  nutritionPoints: number; // out of 60
  additivesPoints: number; // out of 30
  wholeFoodPoints: number; // out of 10
  perServing: NutritionMacros;
  positives: string[];
  negatives: string[];
  contributors: NutritionContributor[];
  coveragePct: number;
}

export interface IngredientInput {
  id?: string;
  rawText?: string;
  quantity: number | null;
  unit: string;
  name: string;
  canonicalName?: string;
  aisle?: GroceryAisle;
  notes?: string;
  foodBarcode?: string | null;
  estimatedCostCents?: number;
}

export interface RecipeIngredient extends IngredientInput {
  id: string;
  canonicalName: string;
  aisle: GroceryAisle;
  notes: string;
  estimatedCostCents: number;
  sortOrder: number;
}

export interface RecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
}

export interface RecipeScreenshot {
  id: string;
  imageKey: string;
  imageUrl: string;
  ocrText: string;
  sortOrder: number;
}

export type PantryMatchStatus = "have_enough" | "partial" | "low_stock" | "missing";

export interface IngredientPantryMatch {
  ingredientId: string;
  status: PantryMatchStatus;
  pantryItemId?: string;
  pantryItemName?: string;
  pantryLocation?: StorageLocation;
  pantryQuantity?: number | null;
  pantryUnit?: string;
  missingQuantity?: number | null;
  missingUnit?: string;
  note: string;
}

export interface RecipePantrySummary {
  haveCount: number;
  partialCount: number;
  missingCount: number;
  totalCount: number;
  readyPct: number;
  missingCostCents: number;
}

export interface RecipeSummary {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  sourceHandle: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  tags: string[];
  nutritionScore: number;
  nutritionGrade: NutritionGrade;
  estimatedCostCents: number;
  costPerServingCents: number;
  pantrySummary: RecipePantrySummary;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeDetail extends RecipeSummary {
  nutritionBreakdown: NutritionBreakdown;
  ingredients: (RecipeIngredient & { pantryMatch: IngredientPantryMatch })[];
  steps: RecipeStep[];
  screenshots: RecipeScreenshot[];
}

export interface PantryItem {
  id: string;
  name: string;
  canonicalName: string;
  location: StorageLocation;
  quantity: number | null;
  unit: string;
  stockStatus: StockStatus;
  barcode: string | null;
  brand: string;
  imageUrl: string;
  unitPriceCents: number | null;
  priceUnit: string;
  expiresAt: string | null;
  updatedAt: string;
}

export interface FoodAdditiveInfo {
  code: string;
  name: string;
  risk: "high" | "moderate" | "limited" | "low";
}

export interface FoodNutriments {
  energyKcal100g?: number;
  fat100g?: number;
  saturatedFat100g?: number;
  carbohydrates100g?: number;
  sugars100g?: number;
  fiber100g?: number;
  proteins100g?: number;
  sodiumMg100g?: number;
  salt100g?: number;
  fruitsVegetablesNuts100g?: number;
}

export interface FoodProduct {
  barcode: string;
  productName: string;
  brand: string;
  imageUrl: string;
  quantityText: string;
  nutriscoreGrade: string;
  nutriscoreScore: number | null;
  novaGroup: number | null;
  additives: FoodAdditiveInfo[];
  isOrganic: boolean;
  nutriments: FoodNutriments;
  yukaScore: number;
  yukaGrade: NutritionGrade;
  positives: string[];
  negatives: string[];
  canonicalGuess: string;
  suggestedLocation: StorageLocation;
  suggestedAisle: GroceryAisle;
}

export interface ShoppingListItem {
  id: string;
  recipeId: string | null;
  recipeTitle: string;
  name: string;
  canonicalName: string;
  quantity: number | null;
  unit: string;
  aisle: GroceryAisle;
  estimatedCostCents: number;
  checked: boolean;
  addedToPantry: boolean;
  createdAt: string;
}

export interface InboxScreenshot {
  id: string;
  imageKey: string;
  imageUrl: string;
  sourceNote: string;
  status: "pending" | "imported";
  createdAt: string;
}

export interface PriceOverride {
  canonicalName: string;
  priceCents: number;
  unit: string;
  source: string;
  updatedAt: string;
}

export interface GeneratedRecipeIdea {
  title: string;
  description: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
  nutritionScore: number;
  nutritionGrade: NutritionGrade;
  nutritionBreakdown: NutritionBreakdown;
  estimatedCostCents: number;
  costPerServingCents: number;
  pantrySummary: RecipePantrySummary;
  usedPantryIngredients: string[];
  missingIngredients: string[];
}
