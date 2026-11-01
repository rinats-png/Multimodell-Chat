import "server-only";
import { createHmac } from "node:crypto";
import { clientIp, HttpError } from "./api";
import { assertProductionConfig } from "./env";
import { securityLog } from "./log";
import { rateLimit, retryAfterSeconds } from "./rate-limit";
import { isSupabaseConfigured } from "./supabase/config";

export function assertAuthAvailable(): void {
  // Auth-Routen fallen genauso geschlossen aus wie der Rest (Upstash, APP_ORIGIN …), Z14-11.
  assertProductionConfig();
  if (!isSupabaseConfigured()) throw new HttpError(404, "not_found", "Nicht gefunden");
}

/**
 * E-Mail als Rate-Limit-/Log-Schlüssel nur als HMAC speichern (Datensparsamkeit, Z14-17):
 * ohne Server-Geheimnis nicht per Wörterbuch auf die Adresse zurückführbar.
 */
export function emailKey(email: string): string {
  const secret = process.env.LOG_HASH_SECRET || process.env.BYOK_ENCRYPTION_KEY || "dev-only-salt";
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export async function limitByIp(request: Request, bucket: string, limit: number, windowMs: number): Promise<void> {
  const result = await rateLimit(bucket, clientIp(request), limit, windowMs);
  if (!result.allowed) {
    securityLog("rate_limited", { bucket });
    throw new HttpError(429, "rate_limited", "Zu viele Versuche. Bitte warte einen Moment.", { "Retry-After": retryAfterSeconds(result) });
  }
}
