import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { UserProfile } from "./types";

export { checkPromptInjection, type InjectionCheckResult } from "./prompt-firewall";

// ---------------------------------------------------------------------------
// Sliding-Window Rate-Limiter (Upstash Redis oder In-Memory)
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Millisekunden bis wieder eine Anfrage möglich ist. */
  retryAfterMs: number;
}

const WINDOW_MS = 60_000;
const memoryWindows = new Map<string, number[]>();

function memoryRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const timestamps = (memoryWindows.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= limit) {
    memoryWindows.set(key, timestamps);
    const oldest = timestamps[0] ?? now;
    return { allowed: false, remaining: 0, retryAfterMs: WINDOW_MS - (now - oldest) };
  }
  timestamps.push(now);
  memoryWindows.set(key, timestamps);
  return { allowed: true, remaining: limit - timestamps.length, retryAfterMs: 0 };
}

const upstashLimiters = new Map<number, Ratelimit>();

function getUpstashLimiter(limit: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  let limiter = upstashLimiters.get(limit);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(limit, "60 s"),
      prefix: `mmchat:rl:${limit}`,
    });
    upstashLimiters.set(limit, limiter);
  }
  return limiter;
}

export async function checkRateLimit(userId: string, limitPerMin: number): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(limitPerMin);
  if (!limiter) return memoryRateLimit(userId, limitPerMin);
  const result = await limiter.limit(userId);
  return {
    allowed: result.success,
    remaining: result.remaining,
    retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
  };
}

// ---------------------------------------------------------------------------
// Token-Kontingent
// ---------------------------------------------------------------------------

export interface QuotaCheckResult {
  allowed: boolean;
  remainingTokens: number;
}

/** Mit eigenem OpenRouter-Key (BYOK) zahlt der User selbst – kein Deckel. */
export function checkTokenQuota(profile: UserProfile): QuotaCheckResult {
  if (profile.custom_openrouter_key) {
    return { allowed: true, remainingTokens: Number.POSITIVE_INFINITY };
  }
  const remainingTokens = profile.monthly_token_limit - profile.tokens_used_this_month;
  return { allowed: remainingTokens > 0, remainingTokens: Math.max(0, remainingTokens) };
}

export class UsageGuardError extends Error {
  constructor(
    public readonly code: "rate_limited" | "quota_exceeded" | "prompt_injection",
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Vor jedem einzelnen Modell-Aufruf: Rate-Limit + Kontingent. */
export async function assertCanCallModel(profile: UserProfile): Promise<void> {
  const quota = checkTokenQuota(profile);
  if (!quota.allowed) {
    throw new UsageGuardError(
      "quota_exceeded",
      "Dein monatliches Token-Kontingent ist aufgebraucht. Upgrade deinen Tarif oder hinterlege einen eigenen OpenRouter-Key.",
      402,
    );
  }
  const rate = await checkRateLimit(profile.id, profile.rate_limit_per_min);
  if (!rate.allowed) {
    throw new UsageGuardError(
      "rate_limited",
      `429 Too Many Requests – Limit von ${profile.rate_limit_per_min} Anfragen/Minute erreicht. Bitte in ${Math.ceil(rate.retryAfterMs / 1000)} s erneut versuchen.`,
      429,
    );
  }
}
