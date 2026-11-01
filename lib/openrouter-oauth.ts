import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { openRouterKeySchema } from "./validation";

/**
 * „Mit OpenRouter verbinden“ (OAuth mit PKCE, https://openrouter.ai/docs/use-cases/oauth-pkce):
 * 1. /api/connect/openrouter erzeugt Prüfwert + state, legt beides in ein HttpOnly-Cookie
 *    und leitet zu openrouter.ai/auth weiter.
 * 2. Der Nutzer bestätigt bei OpenRouter; OpenRouter leitet mit ?code= zurück.
 * 3. Der Callback tauscht code + Prüfwert serverseitig gegen einen nutzereigenen Key.
 */

export const PKCE_COOKIE = "mm_or_pkce";
export const PKCE_MAX_AGE_SECONDS = 600;
const AUTH_URL = "https://openrouter.ai/auth";
const EXCHANGE_URL = "https://openrouter.ai/api/v1/auth/keys";

const b64url = (buf: Buffer) => buf.toString("base64url");

export function createPkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));
  return { verifier, challenge, state, cookieValue: `${state}.${verifier}` };
}

export function authorizeUrl(callbackUrl: string, challenge: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("callback_url", callbackUrl);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

/** Prüft state aus der Rückleitung gegen das Cookie und liefert den Prüfwert. */
export function verifierFromCookie(cookieValue: string | undefined, state: string | null): string | null {
  if (!cookieValue || !state) return null;
  const [expected, verifier] = cookieValue.split(".");
  if (!expected || !verifier) return null;
  const a = Buffer.from(expected);
  const b = Buffer.from(state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return verifier;
}

/** Tauscht den einmaligen Code gegen den Key des Nutzers. */
export async function exchangeCode(code: string, verifier: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(EXCHANGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`OpenRouter-Austausch fehlgeschlagen (${res.status})`);
  const body = (await res.json()) as { key?: unknown };
  return openRouterKeySchema.parse(body.key);
}

/** Eigene, öffentliche Adresse (für die Rückleitung). */
export function appOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN?.trim();
  return configured && /^https?:\/\/[^/]+$/.test(configured) ? configured : new URL(request.url).origin;
}
