import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ConfigError } from "./env";
import { logError, securityLog } from "./log";
import { rateLimit, RATE_LIMITS, retryAfterSeconds } from "./rate-limit";
import { UnauthorizedError } from "./session";
import { UsageGuardError } from "./usage-guard";

/** Projektwert: maximale JSON-Anfrage (docs/idea-to-app/14-sicherheit.md). */
export const MAX_JSON_BYTES = 100 * 1024;

export function jsonError(message: string, status: number, code?: string, headers?: HeadersInit) {
  return NextResponse.json({ error: message, code }, { status, headers });
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
  }
}

export const notFound = () => new HttpError(404, "not_found", "Nicht gefunden");

/** Body mit Größenlimit lesen und gegen ein Schema prüfen (Regeln 4.4, 5.1). */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_JSON_BYTES) throw new HttpError(413, "payload_too_large", "Anfrage zu groß");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) throw new HttpError(413, "payload_too_large", "Anfrage zu groß");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "invalid_json", "Ungültiges JSON");
  }
  return schema.parse(data);
}

/** Pfadparameter validieren; ungültige IDs verhalten sich wie „nicht vorhanden“ (404). */
export function parseParam<T>(value: unknown, schema: ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) throw notFound();
  return result.data;
}

/** Schreibende Anfragen pro Konto begrenzen (Regel 4.1). */
export async function limitMutations(userId: string): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS.mutationsPerAccount;
  const result = await rateLimit("mutation", userId, limit, windowMs);
  if (!result.allowed) {
    securityLog("rate_limited", { bucket: "mutation", userId });
    throw new HttpError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.", { "Retry-After": retryAfterSeconds(result) });
  }
}

/** Client-IP aus den Proxy-Headern der Hosting-Plattform. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Einheitliches Fehler-Mapping: nie interne Details an den Client (Regel 9.3). */
export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.message, error.status, error.code, error.headers);
    if (error instanceof UnauthorizedError) return jsonError("Nicht angemeldet", 401, "unauthorized");
    if (error instanceof UsageGuardError) {
      const headers = error.retryAfterMs ? { "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)) } : undefined;
      return jsonError(error.message, error.status, error.code, headers);
    }
    if (error instanceof ZodError) {
      return jsonError(error.issues.map((i) => `${i.path.join(".") || "Eingabe"}: ${i.message}`).join("; "), 400, "invalid_input");
    }
    const requestId = crypto.randomUUID();
    if (error instanceof ConfigError) {
      logError("config", error, { requestId });
      return jsonError(`Dienst nicht vollständig konfiguriert (Referenz ${requestId}).`, 503, "not_configured");
    }
    logError("api", error, { requestId });
    return jsonError(`Interner Fehler (Referenz ${requestId}).`, 500, "internal");
  }
}
