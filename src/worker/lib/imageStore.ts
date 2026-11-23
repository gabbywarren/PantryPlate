const MAX_IMAGE_BYTES = 1_400_000; // ~1.4 MB raw -> stays safely within D1 row limit after base64

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function saveImageToDb(
  db: D1Database,
  key: string,
  buffer: ArrayBuffer,
  contentType: string
): Promise<void> {
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds 1.4 MB compressed limit. Please upload a smaller image.");
  }
  const base64 = bytesToBase64(new Uint8Array(buffer));
  await db
    .prepare(
      `INSERT OR REPLACE INTO stored_images (key, content_type, data_base64, size_bytes)
       VALUES (?, ?, ?, ?)`
    )
    .bind(key, contentType, base64, buffer.byteLength)
    .run();
}

export async function getImageFromDb(
  db: D1Database,
  key: string
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const row = await db
    .prepare("SELECT content_type, data_base64 FROM stored_images WHERE key = ?")
    .bind(key)
    .first<{ content_type: string; data_base64: string }>();
  if (!row) return null;
  return {
    bytes: base64ToBytes(row.data_base64),
    contentType: row.content_type || "image/jpeg",
  };
}

export async function deleteImagesFromDb(db: D1Database, keys: string[]): Promise<void> {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  if (unique.length === 0) return;
  const statements = unique.map((k) =>
    db.prepare("DELETE FROM stored_images WHERE key = ?").bind(k)
  );
  await db.batch(statements);
}
