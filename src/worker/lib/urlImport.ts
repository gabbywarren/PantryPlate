import { parseIngredientLine, type ParsedRecipeDraft } from "../../shared/recipeParser";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/,
  /^\[?fc/i,
  /^\[?fd/i,
  /^\[?fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

export function validatePublicHttpUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Please enter a valid website URL (e.g. https://example.com/recipe)");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// recipe links are supported");
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || PRIVATE_HOST_PATTERNS.some((re) => re.test(host))) {
    throw new Error("Please enter a public website URL");
  }

  return parsed;
}

export function parseIsoDurationMinutes(iso: unknown): number | null {
  if (typeof iso === "number" && Number.isFinite(iso)) return Math.max(0, Math.round(iso));
  if (typeof iso !== "string") return null;
  const s = iso.trim().toUpperCase();
  if (!s) return null;

  const isoMatch = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (isoMatch) {
    const days = Number(isoMatch[1] || 0);
    const hours = Number(isoMatch[2] || 0);
    const mins = Number(isoMatch[3] || 0);
    const secs = Number(isoMatch[4] || 0);
    const total = days * 1440 + hours * 60 + mins + (secs >= 30 ? 1 : 0);
    return total > 0 ? total : null;
  }

  // Fallback for plain text like "30 mins" or "1 hr 15 min"
  let total = 0;
  const hr = s.match(/(\d+)\s*(?:HR|HRS|HOUR|HOURS)/);
  const mn = s.match(/(\d+)\s*(?:MIN|MINS|MINUTE|MINUTES)/);
  if (hr) total += Number(hr[1]) * 60;
  if (mn) total += Number(mn[1]);
  return total > 0 ? total : null;
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&frac12;/gi, "1/2")
    .replace(/&frac14;/gi, "1/4")
    .replace(/&frac34;/gi, "3/4")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "));
}

function isRecipeNode(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const typeVal = (node as Record<string, unknown>)["@type"];
  if (typeof typeVal === "string") {
    return typeVal.toLowerCase() === "recipe" || typeVal.toLowerCase().endsWith("/recipe");
  }
  if (Array.isArray(typeVal)) {
    return typeVal.some(
      (t) => typeof t === "string" && (t.toLowerCase() === "recipe" || t.toLowerCase().endsWith("/recipe"))
    );
  }
  return false;
}

function findRecipeJsonLdNode(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeJsonLdNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === "object") {
    if (isRecipeNode(data)) return data as Record<string, unknown>;
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      const found = findRecipeJsonLdNode(obj["@graph"]);
      if (found) return found;
    }
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") {
        const found = findRecipeJsonLdNode(val);
        if (found) return found;
      }
    }
  }
  return null;
}

function extractImageUrl(imageField: unknown, pageUrl: string): string | null {
  let raw: string | null = null;
  if (typeof imageField === "string") {
    raw = imageField;
  } else if (Array.isArray(imageField)) {
    for (const entry of imageField) {
      const candidate = extractImageUrl(entry, pageUrl);
      if (candidate) return candidate;
    }
  } else if (imageField && typeof imageField === "object") {
    const obj = imageField as Record<string, unknown>;
    if (typeof obj.url === "string") raw = obj.url;
    else if (typeof obj.contentUrl === "string") raw = obj.contentUrl;
  }
  if (!raw) return null;
  try {
    return new URL(raw, pageUrl).toString();
  } catch {
    return null;
  }
}

function extractSteps(instructionsField: unknown): string[] {
  if (!instructionsField) return [];
  if (typeof instructionsField === "string") {
    return instructionsField
      .split(/\n+/)
      .map((s) => stripTags(s).replace(/^\d+[.)]\s*/, "").trim())
      .filter((s) => s.length > 3);
  }
  if (Array.isArray(instructionsField)) {
    const out: string[] = [];
    for (const item of instructionsField) {
      if (typeof item === "string") {
        const clean = stripTags(item).replace(/^\d+[.)]\s*/, "").trim();
        if (clean) out.push(clean);
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        if (Array.isArray(obj.itemListElement)) {
          out.push(...extractSteps(obj.itemListElement));
        } else if (typeof obj.text === "string") {
          const clean = stripTags(obj.text).replace(/^\d+[.)]\s*/, "").trim();
          if (clean) out.push(clean);
        } else if (typeof obj.name === "string") {
          const clean = stripTags(obj.name).replace(/^\d+[.)]\s*/, "").trim();
          if (clean) out.push(clean);
        }
      }
    }
    return out;
  }
  return [];
}

function extractServings(yieldField: unknown): number {
  const candidates = Array.isArray(yieldField) ? yieldField : [yieldField];
  for (const val of candidates) {
    if (typeof val === "number" && val >= 1 && val <= 32) return Math.round(val);
    if (typeof val === "string") {
      const m = val.match(/\b(\d{1,2})\b/);
      if (m) {
        const n = Number(m[1]);
        if (n >= 1 && n <= 32) return n;
      }
    }
  }
  return 4;
}

function extractAuthorHandle(authorField: unknown, hostname: string): string {
  if (typeof authorField === "string" && authorField.trim()) {
    return decodeHtmlEntities(authorField.trim()).slice(0, 60);
  }
  if (Array.isArray(authorField) && authorField.length > 0) {
    return extractAuthorHandle(authorField[0], hostname);
  }
  if (authorField && typeof authorField === "object") {
    const name = (authorField as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) {
      return decodeHtmlEntities(name.trim()).slice(0, 60);
    }
  }
  return hostname.replace(/^www\./i, "");
}

function extractTags(node: Record<string, unknown>): string[] {
  const tagSet = new Set<string>();
  const addVal = (val: unknown) => {
    if (typeof val === "string") {
      for (const part of val.split(",")) {
        const clean = decodeHtmlEntities(part).toLowerCase().trim();
        if (clean && clean.length >= 2 && clean.length <= 28) {
          tagSet.add(clean);
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach(addVal);
    }
  };
  addVal(node.recipeCategory);
  addVal(node.recipeCuisine);
  addVal(node.keywords);
  return Array.from(tagSet).slice(0, 5);
}

export function extractMetaImageFromHtml(html: string, pageUrl: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      try {
        return new URL(decodeHtmlEntities(m[1]), pageUrl).toString();
      } catch { /* ignore */ }
    }
  }
  return null;
}

export interface JsonLdRecipeResult {
  draft: ParsedRecipeDraft;
  imageUrl: string | null;
}

/**
 * Extracts structured Schema.org JSON-LD Recipe data directly from a recipe webpage's HTML.
 */
export function extractRecipeFromHtmlJsonLd(html: string, pageUrl: string): JsonLdRecipeResult | null {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let recipeNode: Record<string, unknown> | null = null;

  for (const match of html.matchAll(scriptRe)) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson);
      const found = findRecipeJsonLdNode(parsed);
      if (found) {
        recipeNode = found;
        break;
      }
    } catch {
      // Some blogs have minor trailing commas or control characters; skip invalid blocks
      continue;
    }
  }

  if (!recipeNode) return null;

  const title =
    typeof recipeNode.name === "string" ? stripTags(recipeNode.name) : "";
  const description =
    typeof recipeNode.description === "string"
      ? stripTags(recipeNode.description).slice(0, 400)
      : "";

  const rawIngredients = Array.isArray(recipeNode.recipeIngredient)
    ? recipeNode.recipeIngredient
    : Array.isArray(recipeNode.ingredients)
      ? recipeNode.ingredients
      : [];

  const ingredients = rawIngredients
    .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
    .map((line) => parseIngredientLine(stripTags(line)))
    .filter((ing) => ing.name.length > 0);

  const steps = extractSteps(recipeNode.recipeInstructions);

  if (!title && ingredients.length === 0 && steps.length === 0) {
    return null;
  }

  const prep = parseIsoDurationMinutes(recipeNode.prepTime);
  const cook = parseIsoDurationMinutes(recipeNode.cookTime);
  const total = parseIsoDurationMinutes(recipeNode.totalTime);

  let prepMinutes = prep ?? 10;
  let cookMinutes = cook ?? 20;
  if (prep === null && cook === null && total !== null) {
    prepMinutes = Math.max(5, Math.round(total * 0.35));
    cookMinutes = Math.max(0, total - prepMinutes);
  }

  const hostname = new URL(pageUrl).hostname;
  const imageUrl =
    extractImageUrl(recipeNode.image, pageUrl) ?? extractMetaImageFromHtml(html, pageUrl);

  return {
    draft: {
      title: title || "Imported Recipe",
      description,
      sourceHandle: extractAuthorHandle(recipeNode.author, hostname),
      servings: extractServings(recipeNode.recipeYield),
      prepMinutes,
      cookMinutes,
      tags: extractTags(recipeNode),
      ingredients,
      steps,
    },
    imageUrl,
  };
}

/**
 * Strips scripts, styles, nav/footer boilerplate and returns compact readable text for AI fallback.
 */
export function htmlToReadableText(html: string, maxChars = 14000): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|nav|footer)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|p|div|li|h[1-6]|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const lines = withoutNoise
    .split("\n")
    .map((line) => decodeHtmlEntities(line))
    .filter((line) => line.length > 0);

  return lines.join("\n").slice(0, maxChars);
}

/**
 * Fetches a recipe webpage safely with size and timeout limits.
 */
export async function fetchRecipeWebpage(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  const url = validatePublicHttpUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      throw new Error(`Website returned HTTP ${res.status} — try pasting the recipe text or a screenshot instead.`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("That link does not appear to be a recipe webpage.");
    }

    // Stream up to 2 MB max so oversized pages can't exhaust Worker memory
    const maxBytes = 2 * 1024 * 1024;
    const reader = res.body?.getReader();
    if (!reader) {
      return { html: (await res.text()).slice(0, maxBytes), finalUrl: res.url || url.toString() };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        chunks.push(value);
        if (total >= maxBytes) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }

    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const html = new TextDecoder("utf-8", { fatal: false }).decode(merged);
    return { html, finalUrl: res.url || url.toString() };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Timed out loading that website — try pasting the text or a screenshot.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches a recipe's cover image safely (max 1.2 MB) so it can be cached cleanly in D1.
 */
export async function fetchCoverImageBytes(
  rawImageUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const url = validatePublicHttpUrl(rawImageUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(url.toString(), {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "PantryPlate/1.0",
          Accept: "image/jpeg,image/webp,image/png,image/*",
        },
      });
      if (!res.ok) return null;
      const contentType = (res.headers.get("content-type") || "").split(";")[0].trim();
      if (!contentType.startsWith("image/")) return null;
      const contentLen = Number(res.headers.get("content-length") || "0");
      if (contentLen > 1_200_000) return null;

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > 1_200_000) return null;
      return { buffer, contentType };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}
