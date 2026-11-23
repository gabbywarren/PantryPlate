import { Hono } from "hono";
import { z } from "zod";
import { estimateIngredientCostCents } from "../../shared/costEstimator";
import {
  canonicalizeIngredientName,
  guessAisle,
  guessStorageLocation,
  lookupFoodReference,
} from "../../shared/foodDatabase";
import { evaluateRecipePantryMatch } from "../../shared/pantryMatcher";
import { convertUnits, normalizeUnit } from "../../shared/unitConverter";
import type { GroceryAisle, ShoppingListItem } from "../../shared/types";
import type { WorkerBindings } from "../lib/auth";
import {
  loadAllPantryItems,
  loadPriceOverrides,
  mapIngredientRow,
  type IngredientRow,
} from "../lib/dbHelpers";

interface ShoppingRow {
  id: string;
  recipe_id: string | null;
  recipe_title: string;
  name: string;
  canonical_name: string;
  quantity: number | null;
  unit: string;
  aisle: string;
  estimated_cost_cents: number;
  checked: number;
  added_to_pantry: number;
  created_at: string;
}

function mapShoppingRow(r: ShoppingRow): ShoppingListItem {
  return {
    id: r.id,
    recipeId: r.recipe_id,
    recipeTitle: r.recipe_title,
    name: r.name,
    canonicalName: r.canonical_name,
    quantity: r.quantity,
    unit: r.unit,
    aisle: (r.aisle as GroceryAisle) || "Pantry & Grains",
    estimatedCostCents: r.estimated_cost_cents,
    checked: Boolean(r.checked),
    addedToPantry: Boolean(r.added_to_pantry),
    createdAt: r.created_at,
  };
}

export const shoppingRoutes = new Hono<{ Bindings: WorkerBindings }>();

shoppingRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM shopping_list_items ORDER BY checked ASC, aisle ASC, name ASC"
  ).all<ShoppingRow>();

  const items = (results ?? []).map(mapShoppingRow);
  const totalEstimatedCents = items
    .filter((i) => !i.checked)
    .reduce((sum, i) => sum + i.estimatedCostCents, 0);

  return c.json({ items, totalEstimatedCents });
});

const manualItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().nullable().optional().default(1),
  unit: z.string().max(32).optional().default("each"),
  aisle: z.string().optional(),
});

shoppingRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = manualItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid shopping item" }, 400);
  }

  const d = parsed.data;
  const canonicalName = canonicalizeIngredientName(d.name);
  const unit = normalizeUnit(d.unit);
  const aisle = (d.aisle as GroceryAisle) || guessAisle(d.name);
  const [priceOverrides, pantryItems] = await Promise.all([
    loadPriceOverrides(c.env.DB),
    loadAllPantryItems(c.env.DB),
  ]);
  const cost = estimateIngredientCostCents(
    { name: d.name, canonicalName, quantity: d.quantity, unit },
    priceOverrides,
    pantryItems
  );

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO shopping_list_items (
       id, recipe_id, recipe_title, name, canonical_name, quantity, unit, aisle, estimated_cost_cents
     ) VALUES (?, NULL, '', ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, d.name.trim(), canonicalName, d.quantity, unit, aisle, cost.costCents)
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM shopping_list_items WHERE id = ?")
    .bind(id)
    .first<ShoppingRow>();

  return c.json({ item: row ? mapShoppingRow(row) : null }, 201);
});

const fromRecipeBodySchema = z
  .object({
    ingredientIds: z.array(z.string()).optional(),
    scale: z.number().min(0.25).max(10).optional().default(1),
    includeOwned: z.boolean().optional().default(false),
  })
  .optional();

// Add missing (or selected) ingredients from a recipe to the master shopping list, merging duplicates
shoppingRoutes.post("/from-recipe/:recipeId", async (c) => {
  const recipeId = c.req.param("recipeId");
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = fromRecipeBodySchema.safeParse(rawBody);
  const opts = parsed.success && parsed.data ? parsed.data : { scale: 1, includeOwned: false };

  const recipe = await c.env.DB.prepare("SELECT id, title FROM recipes WHERE id = ?")
    .bind(recipeId)
    .first<{ id: string; title: string }>();
  if (!recipe) {
    return c.json({ error: "Recipe not found" }, 404);
  }

  const [{ results: ingRows }, pantryItems, { results: existingShopRows }] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY sort_order ASC")
      .bind(recipeId)
      .all<IngredientRow>(),
    loadAllPantryItems(c.env.DB),
    c.env.DB.prepare("SELECT * FROM shopping_list_items WHERE checked = 0").all<ShoppingRow>(),
  ]);

  const mapped = (ingRows ?? []).map((row) => {
    const ing = mapIngredientRow(row);
    if (opts.scale && opts.scale !== 1) {
      return {
        ...ing,
        quantity: ing.quantity !== null ? Math.round(ing.quantity * opts.scale * 100) / 100 : null,
        estimatedCostCents: Math.round(ing.estimatedCostCents * opts.scale),
      };
    }
    return ing;
  });

  const { matches } = evaluateRecipePantryMatch(mapped, pantryItems);
  const existingByCanonical = new Map<string, ShoppingRow>();
  for (const row of existingShopRows ?? []) {
    existingByCanonical.set(row.canonical_name, row);
  }

  let addedCount = 0;
  let mergedCount = 0;

  for (const ing of mapped) {
    if (opts.ingredientIds && !opts.ingredientIds.includes(ing.id)) continue;
    const match = matches.get(ing.id);
    if (!opts.includeOwned && match?.status === "have_enough") continue;

    const neededQty =
      match?.status === "partial" && match.missingQuantity ? match.missingQuantity : ing.quantity;
    const neededCost =
      match?.status === "partial" && ing.quantity && match.missingQuantity
        ? Math.round(ing.estimatedCostCents * (match.missingQuantity / ing.quantity))
        : ing.estimatedCostCents;

    const existing = existingByCanonical.get(ing.canonicalName);
    if (existing) {
      let newQty = existing.quantity;
      if (existing.quantity !== null && neededQty !== null) {
        const foodRef = lookupFoodReference(ing.canonicalName);
        const converted = convertUnits(neededQty, ing.unit, existing.unit, foodRef);
        if (converted !== null) {
          newQty = Math.round((existing.quantity + converted) * 100) / 100;
        } else {
          newQty = Math.round((existing.quantity + neededQty) * 100) / 100;
        }
      }
      const newRecipeTitle = existing.recipe_title.includes(recipe.title)
        ? existing.recipe_title
        : existing.recipe_title
          ? `${existing.recipe_title}, ${recipe.title}`
          : recipe.title;

      await c.env.DB.prepare(
        `UPDATE shopping_list_items
         SET quantity = ?, estimated_cost_cents = ?, recipe_title = ?
         WHERE id = ?`
      )
        .bind(newQty, existing.estimated_cost_cents + neededCost, newRecipeTitle, existing.id)
        .run();

      existing.quantity = newQty;
      existing.estimated_cost_cents += neededCost;
      mergedCount += 1;
    } else {
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        `INSERT INTO shopping_list_items (
           id, recipe_id, recipe_title, name, canonical_name, quantity, unit, aisle, estimated_cost_cents
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          recipe.id,
          recipe.title,
          ing.name,
          ing.canonicalName,
          neededQty,
          ing.unit,
          ing.aisle,
          neededCost
        )
        .run();

      existingByCanonical.set(ing.canonicalName, {
        id,
        recipe_id: recipe.id,
        recipe_title: recipe.title,
        name: ing.name,
        canonical_name: ing.canonicalName,
        quantity: neededQty,
        unit: ing.unit,
        aisle: ing.aisle,
        estimated_cost_cents: neededCost,
        checked: 0,
        added_to_pantry: 0,
        created_at: new Date().toISOString(),
      });
      addedCount += 1;
    }
  }

  return c.json({ addedCount, mergedCount });
});

shoppingRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM shopping_list_items WHERE id = ?")
    .bind(id)
    .first<ShoppingRow>();
  if (!existing) {
    return c.json({ error: "Item not found" }, 404);
  }

  const body = await c.req.json<{ checked?: boolean; quantity?: number | null }>();
  const checked = body.checked !== undefined ? (body.checked ? 1 : 0) : existing.checked;
  const quantity = body.quantity !== undefined ? body.quantity : existing.quantity;

  await c.env.DB.prepare("UPDATE shopping_list_items SET checked = ?, quantity = ? WHERE id = ?")
    .bind(checked, quantity, id)
    .run();

  const updated = await c.env.DB.prepare("SELECT * FROM shopping_list_items WHERE id = ?")
    .bind(id)
    .first<ShoppingRow>();

  return c.json({ item: updated ? mapShoppingRow(updated) : null });
});

// Move all checked store items straight into the user's Pantry & Fridge!
shoppingRoutes.post("/move-checked-to-pantry", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM shopping_list_items WHERE checked = 1 AND added_to_pantry = 0"
  ).all<ShoppingRow>();

  let movedCount = 0;
  for (const item of results ?? []) {
    const existingPantry = await c.env.DB.prepare(
      "SELECT id, quantity, unit FROM pantry_items WHERE canonical_name = ?"
    )
      .bind(item.canonical_name)
      .first<{ id: string; quantity: number | null; unit: string }>();

    if (existingPantry) {
      let updatedQty = existingPantry.quantity;
      if (existingPantry.quantity !== null && item.quantity !== null) {
        const foodRef = lookupFoodReference(item.canonical_name);
        const conv = convertUnits(item.quantity, item.unit, existingPantry.unit, foodRef);
        updatedQty = Math.round((existingPantry.quantity + (conv ?? item.quantity)) * 100) / 100;
      }
      await c.env.DB.prepare(
        "UPDATE pantry_items SET stock_status = 'in_stock', quantity = ?, updated_at = datetime('now') WHERE id = ?"
      )
        .bind(updatedQty, existingPantry.id)
        .run();
    } else {
      const location = guessStorageLocation(item.name);
      await c.env.DB.prepare(
        `INSERT INTO pantry_items (id, name, canonical_name, location, quantity, unit, stock_status)
         VALUES (?, ?, ?, ?, ?, ?, 'in_stock')`
      )
        .bind(
          crypto.randomUUID(),
          item.name,
          item.canonical_name,
          location,
          item.quantity,
          item.unit
        )
        .run();
    }

    await c.env.DB.prepare("UPDATE shopping_list_items SET added_to_pantry = 1 WHERE id = ?")
      .bind(item.id)
      .run();
    movedCount += 1;
  }

  return c.json({ movedCount });
});

shoppingRoutes.delete("/checked", async (c) => {
  await c.env.DB.prepare("DELETE FROM shopping_list_items WHERE checked = 1").run();
  return c.json({ cleared: true });
});

shoppingRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM shopping_list_items WHERE id = ?").bind(id).run();
  return c.json({ deleted: true });
});
