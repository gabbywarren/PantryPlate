import type { ParsedRecipeDraft } from "../shared/recipeParser";
import type {
  FoodProduct,
  GeneratedRecipeIdea,
  InboxScreenshot,
  IngredientInput,
  PantryItem,
  PriceOverride,
  RecipeDetail,
  RecipeSummary,
  ShoppingListItem,
  StockStatus,
  StorageLocation,
} from "../shared/types";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error || `Request failed (${res.status})`,
      res.status
    );
  }
  return data as T;
}

export interface RecipeSavePayload {
  title: string;
  description: string;
  sourceUrl: string;
  sourceHandle: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  coverImageKey: string | null;
  tags: string[];
  ingredients: IngredientInput[];
  steps: string[];
  screenshots: { imageKey: string; ocrText: string }[];
  inboxId?: string;
}

async function compressImageForUpload(file: File, maxDim = 1600): Promise<File> {
  if (file.size <= 450_000) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image"));
      el.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    if (!blob) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const api = {
  auth: {
    status: () => request<{ pinRequired: boolean; authenticated: boolean }>("/api/auth/status"),
    unlock: (pin: string) =>
      request<{ authenticated: boolean }>("/api/auth/unlock", {
        method: "POST",
        body: JSON.stringify({ pin }),
      }),
  },

  recipes: {
    list: (params?: { q?: string; sort?: string; filter?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set("q", params.q);
      if (params?.sort) qs.set("sort", params.sort);
      if (params?.filter) qs.set("filter", params.filter);
      const query = qs.toString();
      return request<{ recipes: RecipeSummary[] }>(`/api/recipes${query ? `?${query}` : ""}`);
    },
    get: (id: string) => request<{ recipe: RecipeDetail }>(`/api/recipes/${id}`),
    create: (payload: RecipeSavePayload) =>
      request<{ id: string; nutritionScore: number; estimatedCostCents: number }>("/api/recipes", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: RecipeSavePayload) =>
      request<{ id: string; nutritionScore: number; estimatedCostCents: number }>(
        `/api/recipes/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      ),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/api/recipes/${id}`, { method: "DELETE" }),
    uploadImage: async (file: File, kind: "screenshot" | "cover" = "screenshot") => {
      const optimized = await compressImageForUpload(file, kind === "cover" ? 1200 : 1600);
      const form = new FormData();
      form.append("file", optimized);
      form.append("kind", kind);
      return request<{ imageKey: string; imageUrl: string }>("/api/recipes/upload-image", {
        method: "POST",
        body: form,
      });
    },
    aiStatus: () => request<{ aiEnabled: boolean; model: string }>("/api/recipes/ai-status"),
    extractAi: (payload: { imageKeys?: string[]; rawText?: string }) =>
      request<{ draft: ParsedRecipeDraft; model: string }>("/api/recipes/extract-ai", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    importUrl: (url: string) =>
      request<{
        draft: ParsedRecipeDraft;
        sourceUrl: string;
        coverImageKey: string | null;
        coverImageUrl: string | null;
        method: "json-ld" | "gpt-6-luna" | "local-parser";
      }>("/api/recipes/import-url", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    generateFromPantry: (payload: {
      mealType?: "any" | "breakfast" | "lunch" | "dinner" | "snack" | "dessert";
      maxMinutes?: number;
      strictMode?: boolean;
      craving?: string;
      priorityItemIds?: string[];
    }) =>
      request<{ ideas: GeneratedRecipeIdea[]; model: string; pantryCountUsed: number }>(
        "/api/recipes/generate-from-pantry",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),
    seedSamples: () =>
      request<{ seededRecipes: number; starterPantryAdded: boolean }>(
        "/api/recipes/seed-samples",
        { method: "POST" }
      ),
  },

  pantry: {
    list: () => request<{ items: PantryItem[] }>("/api/pantry"),
    create: (payload: {
      name: string;
      canonicalName?: string;
      location?: StorageLocation;
      quantity?: number | null;
      unit?: string;
      stockStatus?: StockStatus;
      barcode?: string | null;
      brand?: string;
      imageUrl?: string;
      unitPriceCents?: number | null;
      priceUnit?: string;
      expiresAt?: string | null;
    }) =>
      request<{ item: PantryItem }>("/api/pantry", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
        name: string;
        canonicalName: string;
        location: StorageLocation;
        quantity: number | null;
        unit: string;
        stockStatus: StockStatus;
        unitPriceCents: number | null;
        priceUnit: string;
        expiresAt: string | null;
      }>
    ) =>
      request<{ item: PantryItem }>(`/api/pantry/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/api/pantry/${id}`, { method: "DELETE" }),
  },

  food: {
    barcode: (code: string) =>
      request<{ product: FoodProduct; source: "cache" | "openfoodfacts" }>(
        `/api/food/barcode/${encodeURIComponent(code)}`
      ),
    search: (q: string) =>
      request<{
        staples: {
          name: string;
          canonicalName: string;
          aisle: string;
          defaultLocation: StorageLocation;
          priceCents: number;
          priceUnit: string;
          source: "staple";
        }[];
        catalog: FoodProduct[];
      }>(`/api/food/search?q=${encodeURIComponent(q)}`),
    listPrices: () => request<{ overrides: PriceOverride[] }>("/api/food/prices"),
    setPrice: (canonicalName: string, priceCents: number, unit: string) =>
      request<{ canonicalName: string; priceCents: number; unit: string }>(
        `/api/food/prices/${encodeURIComponent(canonicalName)}`,
        {
          method: "PUT",
          body: JSON.stringify({ priceCents, unit }),
        }
      ),
    deletePrice: (canonicalName: string) =>
      request<{ deleted: boolean }>(`/api/food/prices/${encodeURIComponent(canonicalName)}`, {
        method: "DELETE",
      }),
  },

  shopping: {
    list: () =>
      request<{ items: ShoppingListItem[]; totalEstimatedCents: number }>("/api/shopping"),
    addManual: (payload: { name: string; quantity?: number | null; unit?: string }) =>
      request<{ item: ShoppingListItem }>("/api/shopping", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    addFromRecipe: (
      recipeId: string,
      opts?: { ingredientIds?: string[]; scale?: number; includeOwned?: boolean }
    ) =>
      request<{ addedCount: number; mergedCount: number }>(
        `/api/shopping/from-recipe/${recipeId}`,
        {
          method: "POST",
          body: JSON.stringify(opts ?? {}),
        }
      ),
    patch: (id: string, payload: { checked?: boolean; quantity?: number | null }) =>
      request<{ item: ShoppingListItem }>(`/api/shopping/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    moveCheckedToPantry: () =>
      request<{ movedCount: number }>("/api/shopping/move-checked-to-pantry", {
        method: "POST",
      }),
    clearChecked: () =>
      request<{ cleared: boolean }>("/api/shopping/checked", { method: "DELETE" }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/api/shopping/${id}`, { method: "DELETE" }),
  },

  inbox: {
    list: () => request<{ items: InboxScreenshot[] }>("/api/inbox"),
    getToken: () => request<{ token: string; endpointUrl: string }>("/api/inbox/token"),
    rotateToken: () =>
      request<{ token: string; endpointUrl: string }>("/api/inbox/token/rotate", {
        method: "POST",
      }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/api/inbox/${id}`, { method: "DELETE" }),
  },
};
