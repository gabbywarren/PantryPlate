import { Hono } from "hono";
import { z } from "zod";
import { canonicalizeIngredientName, guessStorageLocation } from "../../shared/foodDatabase";
import { normalizeUnit } from "../../shared/unitConverter";
import type { WorkerBindings } from "../lib/auth";
import {
  loadAllPantryItems,
  mapPantryRow,
  recalculateRecipeMetrics,
  type PantryRow,
} from "../lib/dbHelpers";

const pantryUpsertSchema = z.object({
  name: z.string().min(1).max(140),
  canonicalName: z.string().max(100).optional(),
  location: z.enum(["fridge", "freezer", "pantry", "spices"]).optional(),
  quantity: z.number().min(0).nullable().optional().default(null),
  unit: z.string().max(32).optional().default(""),
  stockStatus: z.enum(["in_stock", "low", "out"]).optional().default("in_stock"),
  barcode: z.string().max(64).nullable().optional().default(null),
  brand: z.string().max(100).optional().default(""),
  imageUrl: z.string().max(500).optional().default(""),
  unitPriceCents: z.number().int().min(0).nullable().optional().default(null),
  priceUnit: z.string().max(32).optional().default(""),
  expiresAt: z.string().max(32).nullable().optional().default(null),
});

export const pantryRoutes = new Hono<{ Bindings: WorkerBindings }>();

pantryRoutes.get("/", async (c) => {
  const items = await loadAllPantryItems(c.env.DB);
  return c.json({ items });
});

pantryRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = pantryUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid pantry item", details: parsed.error.flatten() }, 400);
  }

  const d = parsed.data;
  const canonicalName = d.canonicalName?.trim().toLowerCase() || canonicalizeIngredientName(d.name);
  const location = d.location ?? guessStorageLocation(d.name);
  const unit = normalizeUnit(d.unit);
  const priceUnit = normalizeUnit(d.priceUnit || unit || "each");
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO pantry_items (
       id, name, canonical_name, location, quantity, unit, stock_status,
       barcode, brand, image_url, unit_price_cents, price_unit, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      d.name.trim(),
      canonicalName,
      location,
      d.quantity,
      unit,
      d.stockStatus,
      d.barcode,
      d.brand.trim(),
      d.imageUrl.trim(),
      d.unitPriceCents,
      priceUnit,
      d.expiresAt
    )
    .run();

  if (d.unitPriceCents && d.unitPriceCents > 0) {
    c.executionCtx.waitUntil(recalculateRecipeMetrics(c.env.DB, canonicalName));
  }

  const row = await c.env.DB.prepare("SELECT * FROM pantry_items WHERE id = ?")
    .bind(id)
    .first<PantryRow>();

  return c.json({ item: row ? mapPantryRow(row) : null }, 201);
});

pantryRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT * FROM pantry_items WHERE id = ?")
    .bind(id)
    .first<PantryRow>();
  if (!existing) {
    return c.json({ error: "Pantry item not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = pantryUpsertSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid update payload", details: parsed.error.flatten() }, 400);
  }

  const d = parsed.data;
  const name = d.name !== undefined ? d.name.trim() : existing.name;
  const canonicalName =
    d.canonicalName !== undefined
      ? d.canonicalName.trim().toLowerCase() || canonicalizeIngredientName(name)
      : existing.canonical_name;
  const location = d.location ?? existing.location;
  const quantity = d.quantity !== undefined ? d.quantity : existing.quantity;
  const unit = d.unit !== undefined ? normalizeUnit(d.unit) : existing.unit;
  const stockStatus = d.stockStatus ?? existing.stock_status;
  const unitPriceCents = d.unitPriceCents !== undefined ? d.unitPriceCents : existing.unit_price_cents;
  const priceUnit = d.priceUnit !== undefined ? normalizeUnit(d.priceUnit) : existing.price_unit;
  const expiresAt = d.expiresAt !== undefined ? d.expiresAt : existing.expires_at;

  await c.env.DB.prepare(
    `UPDATE pantry_items
     SET name = ?, canonical_name = ?, location = ?, quantity = ?, unit = ?,
         stock_status = ?, unit_price_cents = ?, price_unit = ?, expires_at = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      name,
      canonicalName,
      location,
      quantity,
      unit,
      stockStatus,
      unitPriceCents,
      priceUnit,
      expiresAt,
      id
    )
    .run();

  if (d.unitPriceCents !== undefined) {
    c.executionCtx.waitUntil(recalculateRecipeMetrics(c.env.DB, canonicalName));
  }

  const updated = await c.env.DB.prepare("SELECT * FROM pantry_items WHERE id = ?")
    .bind(id)
    .first<PantryRow>();

  return c.json({ item: updated ? mapPantryRow(updated) : null });
});

pantryRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM pantry_items WHERE id = ?").bind(id).run();
  return c.json({ deleted: true });
});
