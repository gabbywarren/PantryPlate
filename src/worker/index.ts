import { Hono } from "hono";
import {
  clearSessionCookie,
  createSessionCookie,
  timingSafeEqualStr,
  verifySessionCookie,
  type WorkerBindings,
} from "./lib/auth";
import { foodRoutes } from "./routes/food";
import { imagesRoutes } from "./routes/images";
import { inboxRoutes } from "./routes/inbox";
import { pantryRoutes } from "./routes/pantry";
import { recipesRoutes } from "./routes/recipes";
import { shoppingRoutes } from "./routes/shopping";

const app = new Hono<{ Bindings: WorkerBindings }>();

// Structured JSON request logging (Workers Observability best practice)
app.use("/api/*", async (c, next) => {
  const start = Date.now();
  await next();
  console.log(
    JSON.stringify({
      message: "api_request",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - start,
    })
  );
});

// Optional household PIN gate when APP_PIN secret is configured
app.get("/api/auth/status", async (c) => {
  const pin = c.env.APP_PIN;
  if (!pin) {
    return c.json({ pinRequired: false, authenticated: true });
  }
  const authenticated = await verifySessionCookie(c.req.header("cookie"), pin);
  return c.json({ pinRequired: true, authenticated });
});

app.post("/api/auth/unlock", async (c) => {
  const pin = c.env.APP_PIN;
  if (!pin) {
    return c.json({ authenticated: true });
  }
  const body = await c.req.json<{ pin?: string }>().catch(() => ({ pin: "" }));
  const candidate = String(body.pin || "").trim();
  const valid = await timingSafeEqualStr(candidate, pin);
  if (!valid) {
    return c.json({ error: "Incorrect PIN" }, 401);
  }
  const isSecure = new URL(c.req.url).protocol === "https:";
  c.header("Set-Cookie", await createSessionCookie(pin, isSecure));
  return c.json({ authenticated: true });
});

app.post("/api/auth/logout", (c) => {
  c.header("Set-Cookie", clearSessionCookie());
  return c.json({ authenticated: false });
});

app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  // Auth endpoints, health check, and token-authenticated Shortcut inbox bypass cookie check
  if (
    path.startsWith("/api/auth/") ||
    path === "/api/health" ||
    (path === "/api/inbox/screenshot" && c.req.method === "POST")
  ) {
    return next();
  }

  const pin = c.env.APP_PIN;
  if (pin) {
    const ok = await verifySessionCookie(c.req.header("cookie"), pin);
    if (!ok) {
      return c.json({ error: "Authentication required", pinRequired: true }, 401);
    }
  }
  return next();
});

app.get("/api/health", (c) => c.json({ status: "ok", app: "pantryplate" }));

app.route("/api/recipes", recipesRoutes);
app.route("/api/pantry", pantryRoutes);
app.route("/api/food", foodRoutes);
app.route("/api/shopping", shoppingRoutes);
app.route("/api/inbox", inboxRoutes);
app.route("/images", imagesRoutes);

app.onError((err, c) => {
  console.error(
    JSON.stringify({
      message: "unhandled_api_error",
      path: c.req.path,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
