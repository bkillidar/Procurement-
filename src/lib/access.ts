// Optional shared-password gate. Off unless APP_ACCESS_PASSWORD is set.
// The cookie holds an HMAC of a fixed label keyed by the password, never the password itself.
// Uses only Web Crypto so it runs in the proxy as well as in server actions.

export const ACCESS_COOKIE = "ops_access";
const LABEL = "development-ops-access-v1";

export async function accessToken(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(LABEL));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Paths reachable without the password. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/unlock" || pathname.startsWith("/unlock/") || pathname === "/api/health";
}

/** Same-site redirect targets only. */
export function safeNext(value: string | null | undefined): string {
  const v = value ?? "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && !v.startsWith("/unlock") ? v : "/";
}
