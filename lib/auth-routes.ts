import "server-only";
import { createHash } from "node:crypto";
import { clientIp, HttpError } from "./api";
import { securityLog } from "./log";
import { rateLimit, retryAfterSeconds } from "./rate-limit";
import { isSupabaseConfigured } from "./supabase/config";

export function assertAuthAvailable(): void {
  if (!isSupabaseConfigured()) throw new HttpError(404, "not_found", "Nicht gefunden");
}

/** E-Mail als Rate-Limit-Schlüssel nur gehasht speichern (Datensparsamkeit). */
export function emailKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export async function limitByIp(request: Request, bucket: string, limit: number, windowMs: number): Promise<void> {
  const result = await rateLimit(bucket, clientIp(request), limit, windowMs);
  if (!result.allowed) {
    securityLog("rate_limited", { bucket });
    throw new HttpError(429, "rate_limited", "Zu viele Versuche. Bitte warte einen Moment.", { "Retry-After": retryAfterSeconds(result) });
  }
}
