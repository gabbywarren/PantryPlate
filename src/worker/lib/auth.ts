export type WorkerBindings = Env & {
  APP_PIN?: string;
  OPENAI_API_KEY?: string;
};

const COOKIE_NAME = "pantryplate_session";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison using SHA-256 digests via Web Crypto.
 */
export async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  if (viewA.length !== viewB.length) return false;
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }
  return diff === 0;
}

async function signSessionPayload(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(sig);
}

export async function createSessionCookie(pinSecret: string, isSecure: boolean): Promise<string> {
  const issuedAt = String(Date.now());
  const sig = await signSessionPayload(`pp:${issuedAt}`, pinSecret);
  const value = `${issuedAt}.${sig}`;
  const attrs = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (isSecure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function verifySessionCookie(cookieHeader: string | undefined, pinSecret: string): Promise<boolean> {
  if (!cookieHeader) return false;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const found = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!found) return false;
  const val = found.slice(COOKIE_NAME.length + 1);
  const [issuedAt, sig] = val.split(".");
  if (!issuedAt || !sig) return false;
  const expected = await signSessionPayload(`pp:${issuedAt}`, pinSecret);
  return timingSafeEqualStr(sig, expected);
}

export async function getOrCreateShareToken(db: D1Database): Promise<string> {
  const existing = await db
    .prepare("SELECT value FROM app_settings WHERE key = 'share_token'")
    .first<{ value: string }>();
  if (existing?.value) return existing.value;

  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await db
    .prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('share_token', ?, datetime('now'))")
    .bind(token)
    .run();

  return token;
}

export async function rotateShareToken(db: D1Database): Promise<string> {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await db
    .prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('share_token', ?, datetime('now'))")
    .bind(token)
    .run();

  return token;
}
