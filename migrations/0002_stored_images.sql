-- Store compressed recipe screenshots and dish photos directly in D1 (no R2 billing activation required)

CREATE TABLE IF NOT EXISTS stored_images (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  data_base64 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
