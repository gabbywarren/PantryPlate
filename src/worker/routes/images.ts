import { Hono } from "hono";
import type { WorkerBindings } from "../lib/auth";
import { getImageFromDb } from "../lib/imageStore";

export const imagesRoutes = new Hono<{ Bindings: WorkerBindings }>();

imagesRoutes.get("/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  if (!key || key.includes("..")) {
    return c.json({ error: "Invalid image key" }, 400);
  }

  const found = await getImageFromDb(c.env.DB, key);
  if (!found) {
    return c.json({ error: "Image not found" }, 404);
  }

  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "content-type": found.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});
