import { hasUniversalOwnAccess } from "./ai/provider";
import { rateLimit, type RateLimitResult } from "./rate-limit";
import type { UserProfile } from "./types";

export { checkPromptInjection, type InjectionCheckResult } from "./prompt-firewall";

export interface QuotaCheckResult {
  allowed: boolean;
  remainingTokens: number;
}

/**
 * Prüft, ob der geschätzte Verbrauch eines Aufrufs noch ins Monatskontingent passt (BF-03).
 * Mit eigenem Zugang für alle Modelle (OpenRouter oder Gateway) zahlt der User selbst – kein Deckel.
 */
export function checkTokenQuota(profile: UserProfile, estimatedTokens = 1): QuotaCheckResult {
  if (hasUniversalOwnAccess(profile)) {
    return { allowed: true, remainingTokens: Number.POSITIVE_INFINITY };
  }
  const remainingTokens = Math.max(0, profile.monthly_token_limit - profile.tokens_used_this_month);
  return { allowed: remainingTokens >= Math.max(1, estimatedTokens), remainingTokens };
}

export type UsageGuardCode = "rate_limited" | "quota_exceeded" | "prompt_injection" | "model_not_allowed" | "busy";

export class UsageGuardError extends Error {
  constructor(
    public readonly code: UsageGuardCode,
    message: string,
    public readonly status: number,
    public readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}

export function rateLimitMessage(limit: number, result: RateLimitResult): string {
  return `Zu viele Anfragen – Limit von ${limit} pro Minute erreicht. Bitte in ${Math.ceil(result.retryAfterMs / 1000)} s erneut versuchen.`;
}

export function assertQuota(profile: UserProfile, estimatedTokens: number): void {
  const quota = checkTokenQuota(profile, estimatedTokens);
  if (!quota.allowed) {
    throw new UsageGuardError(
      "quota_exceeded",
      quota.remainingTokens > 0
        ? `Dein restliches Kontingent (${quota.remainingTokens} Tokens) reicht für diese Antwort nicht aus (≈ ${estimatedTokens} Tokens). Verkleinere das Kontextfenster oder upgrade deinen Tarif.`
        : "Dein monatliches Token-Kontingent ist aufgebraucht. Verbinde dein OpenRouter-Konto oder hinterlege einen eigenen API-Key.",
      402,
    );
  }
}

/**
 * Vor jeder Agenten-Antwort: Kontingent (inkl. Schätzung) + Minutenlimit des Tarifs.
 * Router- und Summary-Aufrufe zählen nicht gegen das Minutenlimit (BF-25), nur gegen
 * das Kontingent – sie sind über das Rundenlimit begrenzt.
 */
export async function assertCanCallModel(profile: UserProfile, estimatedTokens: number, options: { ownAccess?: boolean } = {}): Promise<void> {
  // Eigener Zugang für genau dieses Modell (z. B. Anthropic-Key, lokales Abo): kein Kontingent.
  if (!options.ownAccess) assertQuota(profile, estimatedTokens);
  const rate = await rateLimit("model", profile.id, profile.rate_limit_per_min);
  if (!rate.allowed) {
    throw new UsageGuardError("rate_limited", rateLimitMessage(profile.rate_limit_per_min, rate), 429, rate.retryAfterMs);
  }
}
