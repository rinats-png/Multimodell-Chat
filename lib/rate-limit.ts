import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Sliding-Window-Rate-Limiter. Mit Upstash Redis instanzübergreifend (Pflicht in
 * Produktion, siehe lib/env.ts), sonst In-Memory pro Server-Instanz (Entwicklung).
 * Ohne Node-Abhängigkeiten, damit er auch in der Middleware (Edge) läuft.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Millisekunden bis wieder eine Anfrage möglich ist. */
  retryAfterMs: number;
}

/** Projektwerte aus docs/idea-to-app/14-sicherheit.md → Rate Limits. */
export const RATE_LIMITS = {
  /** Alle /api-Anfragen pro IP */
  apiPerIp: { limit: 300, windowMs: 60_000 },
  /** Schreibende API-Anfragen pro Konto */
  mutationsPerAccount: { limit: 60, windowMs: 60_000 },
  /** Orchestrierungs-Runden pro IP (teurer Endpunkt) */
  roundsPerIp: { limit: 20, windowMs: 60_000 },
  /** Konto-Löschung / Export pro Konto */
  accountActionsPerAccount: { limit: 5, windowMs: 60 * 60_000 },
  /** Login-Versuche pro IP */
  loginPerIp: { limit: 20, windowMs: 15 * 60_000 },
  /** Fehlgeschlagene Logins pro Konto (E-Mail) – danach vorübergehend gesperrt */
  loginFailuresPerAccount: { limit: 5, windowMs: 15 * 60_000 },
  /** Registrierungen pro IP */
  signupPerIp: { limit: 5, windowMs: 60 * 60_000 },
  /** Passwort-Reset-Mails pro IP bzw. pro E-Mail */
  resetPerIp: { limit: 10, windowMs: 60 * 60_000 },
  resetPerAccount: { limit: 3, windowMs: 60 * 60_000 },
} as const;

function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

const limiters = new Map<string, Ratelimit>();

function upstashLimiter(bucket: string, limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${bucket}:${limit}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, `${Math.round(windowMs / 1000)} s`),
      prefix: `mmchat:rl:${bucket}:${limit}`,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

const memoryWindows = new Map<string, number[]>();
const MAX_MEMORY_KEYS = 10_000;

function pruneMemory(now: number): void {
  // BF-18: leere bzw. abgelaufene Fenster entfernen, damit die Map nicht unbegrenzt wächst.
  if (memoryWindows.size < MAX_MEMORY_KEYS) return;
  for (const [key, stamps] of memoryWindows) {
    if (stamps.length === 0 || now - stamps[stamps.length - 1]! > 60 * 60_000) memoryWindows.delete(key);
  }
}

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  pruneMemory(now);
  const stamps = (memoryWindows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= limit) {
    memoryWindows.set(key, stamps);
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, windowMs - (now - stamps[0]!)) };
  }
  stamps.push(now);
  memoryWindows.set(key, stamps);
  return { allowed: true, remaining: limit - stamps.length, retryAfterMs: 0 };
}

export async function rateLimit(bucket: string, id: string, limit: number, windowMs = 60_000): Promise<RateLimitResult> {
  if (!hasUpstash()) return memoryLimit(`${bucket}:${id}`, limit, windowMs);
  const result = await upstashLimiter(bucket, limit, windowMs).limit(id);
  return {
    allowed: result.success,
    remaining: result.remaining,
    retryAfterMs: result.success ? 0 : Math.max(1, result.reset - Date.now()),
  };
}

/** Prüft, ob ein Limit bereits erreicht ist, ohne einen Versuch zu verbrauchen. */
export async function peekLimit(bucket: string, id: string, limit: number, windowMs = 60_000): Promise<RateLimitResult> {
  if (!hasUpstash()) {
    const now = Date.now();
    const stamps = (memoryWindows.get(`${bucket}:${id}`) ?? []).filter((t) => now - t < windowMs);
    return stamps.length >= limit
      ? { allowed: false, remaining: 0, retryAfterMs: Math.max(1, windowMs - (now - stamps[0]!)) }
      : { allowed: true, remaining: limit - stamps.length, retryAfterMs: 0 };
  }
  const { remaining, reset } = await upstashLimiter(bucket, limit, windowMs).getRemaining(id);
  return remaining > 0 ? { allowed: true, remaining, retryAfterMs: 0 } : { allowed: false, remaining: 0, retryAfterMs: Math.max(1, reset - Date.now()) };
}

export function retryAfterSeconds(result: RateLimitResult): string {
  return String(Math.max(1, Math.ceil(result.retryAfterMs / 1000)));
}

// ---------------------------------------------------------------------------
// Sperre gegen parallele Orchestrierungs-Runden desselben Kontos (BF-03, BF-21)
// ---------------------------------------------------------------------------

const memoryLocks = new Map<string, number>();

export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  if (hasUpstash()) {
    const ok = await Redis.fromEnv().set(`mmchat:lock:${key}`, "1", { nx: true, ex: ttlSeconds });
    return ok === "OK";
  }
  const now = Date.now();
  const until = memoryLocks.get(key);
  if (until && until > now) return false;
  memoryLocks.set(key, now + ttlSeconds * 1000);
  return true;
}

export async function releaseLock(key: string): Promise<void> {
  if (hasUpstash()) {
    await Redis.fromEnv().del(`mmchat:lock:${key}`);
    return;
  }
  memoryLocks.delete(key);
}

/** Nur für Tests: In-Memory-Zustand zurücksetzen. */
export function resetRateLimitMemory(): void {
  memoryWindows.clear();
  memoryLocks.clear();
}
