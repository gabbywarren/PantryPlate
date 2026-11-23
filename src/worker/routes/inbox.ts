import { Hono } from "hono";
import type { InboxScreenshot } from "../../shared/types";
import {
  getOrCreateShareToken,
  rotateShareToken,
  timingSafeEqualStr,
  type WorkerBindings,
} from "../lib/auth";
import { imageUrlFromKey } from "../lib/dbHelpers";
import { deleteImagesFromDb, saveImageToDb } from "../lib/imageStore";

export const inboxRoutes = new Hono<{ Bindings: WorkerBindings }>();

// Dedicated Apple Shortcut share endpoint (authenticated via X-Share-Token header or ?token=)
inboxRoutes.post("/screenshot", async (c) => {
  const expectedToken = await getOrCreateShareToken(c.env.DB);
  const providedToken =
    c.req.header("x-share-token") ||
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ||
    c.req.query("token") ||
    "";

  if (!providedToken || !(await timingSafeEqualStr(providedToken, expectedToken))) {
    return c.json({ error: "Invalid or missing share token" }, 401);
  }

  const contentType = c.req.header("content-type") || "";
  let fileBuffer: ArrayBuffer;
  let mimeType = "image/jpeg";
  let sourceNote = c.req.query("note") || "Shared from iPhone";

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    const file = form.get("file") || form.get("image");
    if (!(file instanceof File)) {
      return c.json({ error: "Expected 'file' image field in multipart upload" }, 400);
    }
    mimeType = file.type || "image/jpeg";
    fileBuffer = await file.arrayBuffer();
    const note = form.get("note");
    if (typeof note === "string" && note.trim()) sourceNote = note.trim();
  } else if (contentType.startsWith("image/")) {
    mimeType = contentType.split(";")[0];
    fileBuffer = await c.req.arrayBuffer();
  } else {
    return c.json({ error: "Send image via multipart/form-data or image/* body" }, 400);
  }

  if (fileBuffer.byteLength === 0) {
    return c.json({ error: "Empty image payload" }, 400);
  }

  const ext = mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const id = crypto.randomUUID();
  const imageKey = `inbox/${id}.${ext}`;

  try {
    await saveImageToDb(c.env.DB, imageKey, fileBuffer, mimeType);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Image too large (resize to JPEG in Shortcut)" },
      413
    );
  }

  await c.env.DB.prepare(
    "INSERT INTO screenshot_inbox (id, image_key, source_note, status) VALUES (?, ?, ?, 'pending')"
  )
    .bind(id, imageKey, sourceNote)
    .run();

  const origin = new URL(c.req.url).origin;
  return c.json(
    {
      id,
      imageKey,
      imageUrl: imageUrlFromKey(imageKey),
      importUrl: `${origin}/?tab=import&inbox=${id}`,
    },
    201
  );
});

inboxRoutes.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM screenshot_inbox WHERE status = 'pending' ORDER BY created_at DESC LIMIT 20"
  ).all<{
    id: string;
    image_key: string;
    source_note: string;
    status: "pending" | "imported";
    created_at: string;
  }>();

  const items: InboxScreenshot[] = (results ?? []).map((r) => ({
    id: r.id,
    imageKey: r.image_key,
    imageUrl: imageUrlFromKey(r.image_key) ?? "",
    sourceNote: r.source_note,
    status: r.status,
    createdAt: r.created_at,
  }));

  return c.json({ items });
});

inboxRoutes.get("/token", async (c) => {
  const token = await getOrCreateShareToken(c.env.DB);
  const origin = new URL(c.req.url).origin;
  return c.json({
    token,
    endpointUrl: `${origin}/api/inbox/screenshot`,
  });
});

inboxRoutes.post("/token/rotate", async (c) => {
  const token = await rotateShareToken(c.env.DB);
  const origin = new URL(c.req.url).origin;
  return c.json({
    token,
    endpointUrl: `${origin}/api/inbox/screenshot`,
  });
});

inboxRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT image_key FROM screenshot_inbox WHERE id = ?")
    .bind(id)
    .first<{ image_key: string }>();

  await c.env.DB.prepare("DELETE FROM screenshot_inbox WHERE id = ?").bind(id).run();
  if (row?.image_key) {
    c.executionCtx.waitUntil(deleteImagesFromDb(c.env.DB, [row.image_key]));
  }
  return c.json({ deleted: true });
});
