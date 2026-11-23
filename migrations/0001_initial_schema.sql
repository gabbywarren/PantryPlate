-- PantryPlate Initial D1 Schema

CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_handle TEXT NOT NULL DEFAULT '',
  servings INTEGER NOT NULL DEFAULT 4,
  prep_minutes INTEGER NOT NULL DEFAULT 10,
  cook_minutes INTEGER NOT NULL DEFAULT 20,
  cover_image_key TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  nutrition_score INTEGER NOT NULL DEFAULT 70,
  nutrition_grade TEXT NOT NULL DEFAULT 'good',
  nutrition_breakdown_json TEXT NOT NULL DEFAULT '{}',
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_screenshots (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  image_key TEXT NOT NULL,
  ocr_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipe_screenshots_recipe_id
  ON recipe_screenshots(recipe_id, sort_order);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  raw_text TEXT NOT NULL DEFAULT '',
  quantity REAL,
  unit TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  aisle TEXT NOT NULL DEFAULT 'Pantry & Grains',
  notes TEXT NOT NULL DEFAULT '',
  food_barcode TEXT,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
  ON recipe_ingredients(recipe_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_canonical
  ON recipe_ingredients(canonical_name);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id
  ON recipe_steps(recipe_id, step_number);

CREATE TABLE IF NOT EXISTS pantry_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'pantry',
  quantity REAL,
  unit TEXT NOT NULL DEFAULT '',
  stock_status TEXT NOT NULL DEFAULT 'in_stock',
  barcode TEXT,
  brand TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER,
  price_unit TEXT NOT NULL DEFAULT '',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pantry_canonical ON pantry_items(canonical_name);
CREATE INDEX IF NOT EXISTS idx_pantry_location ON pantry_items(location);

CREATE TABLE IF NOT EXISTS food_catalog (
  barcode TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  quantity_text TEXT NOT NULL DEFAULT '',
  nutriscore_grade TEXT NOT NULL DEFAULT '',
  nutriscore_score INTEGER,
  nova_group INTEGER,
  additives_json TEXT NOT NULL DEFAULT '[]',
  is_organic INTEGER NOT NULL DEFAULT 0,
  nutriments_json TEXT NOT NULL DEFAULT '{}',
  yuka_score INTEGER NOT NULL DEFAULT 50,
  yuka_grade TEXT NOT NULL DEFAULT 'good',
  yuka_summary_json TEXT NOT NULL DEFAULT '{}',
  canonical_guess TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ingredient_price_overrides (
  canonical_name TEXT PRIMARY KEY,
  price_cents INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'each',
  source TEXT NOT NULL DEFAULT 'user',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id TEXT PRIMARY KEY,
  recipe_id TEXT,
  recipe_title TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  quantity REAL,
  unit TEXT NOT NULL DEFAULT '',
  aisle TEXT NOT NULL DEFAULT 'Pantry & Grains',
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  checked INTEGER NOT NULL DEFAULT 0,
  added_to_pantry INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_checked ON shopping_list_items(checked);
CREATE INDEX IF NOT EXISTS idx_shopping_canonical ON shopping_list_items(canonical_name);

CREATE TABLE IF NOT EXISTS screenshot_inbox (
  id TEXT PRIMARY KEY,
  image_key TEXT NOT NULL,
  source_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
