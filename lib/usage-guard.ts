import { hasUniversalOwnAccess } from "./ai/provider";
import { PLANS } from "./plans";
import { rateLimit, type RateLimitResult } from "./rate-limit";
import type { UserProfile } from "./types";

export { checkPromptInjection, type InjectionCheckResult } from "./prompt-firewall";

export interface QuotaCheckResult {
  allowed: boolean;
  /** Was von Monats- bzw. Testkontingent und Tageslimit zusammen noch übrig ist (das Kleinere zählt). */
  remainingTokens: number;
  /** Welche Grenze gerade bindet. */
  limitedBy: "plan" | "day" | "none";
}

/** Heutiger Verbrauch: ein Zähler von einem früheren Tag gilt als 0. */
export function tokensUsedToday(profile: Pick<UserProfile, "tokens_used_today" | "usage_day">, now: Date = new Date()): number {
  return profile.usage_day === now.toISOString().slice(0, 10) ? profile.tokens_used_today : 0;
}

/**
 * Prüft, ob der geschätzte Verbrauch eines Aufrufs noch ins Monatskontingent passt (BF-03).
 * Mit eigenem Zugang für alle Modelle (OpenRouter oder Gateway) zahlt der User selbst – kein Deckel.
 */
export function checkTokenQuota(profile: UserProfile, estimatedTokens = 1): QuotaCheckResult {
  if (hasUniversalOwnAccess(profile)) {
    return { allowed: true, remainingTokens: Number.POSITIVE_INFINITY, limitedBy: "none" };
  }
  const planRemaining = Math.max(0, profile.monthly_token_limit - profile.tokens_used_this_month);
  const dayRemaining = Math.max(0, PLANS[profile.subscription_tier].dailyTokenLimit - tokensUsedToday(profile));
  const remainingTokens = Math.min(planRemaining, dayRemaining);
  return { allowed: remainingTokens >= Math.max(1, estimatedTokens), remainingTokens, limitedBy: dayRemaining < planRemaining ? "day" : "plan" };
}

export type UsageGuardCode = "rate_limited" | "quota_exceeded" | "budget_exhausted" | "prompt_injection" | "model_not_allowed" | "busy";

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
  if (quota.allowed) return;
  const trial = PLANS[profile.subscription_tier].trialOnly;
  let message: string;
  if (quota.limitedBy === "day" && quota.remainingTokens === 0) {
    message = "Das Tageslimit deines Tarifs ist erreicht. Morgen geht es weiter, oder verbinde dein OpenRouter-Konto bzw. einen eigenen API-Key, dann gilt es nicht.";
  } else if (quota.remainingTokens === 0) {
    message = trial
      ? "Dein Testlauf ist aufgebraucht. Verbinde dein OpenRouter-Konto oder hinterlege einen eigenen API-Key unter „Tarif & Verbrauch“, dann kannst du unbegrenzt weiterdebattieren."
      : "Dein monatliches Token-Kontingent ist aufgebraucht. Verbinde dein OpenRouter-Konto oder hinterlege einen eigenen API-Key.";
  } else {
    message = `Dein restliches Kontingent (${quota.remainingTokens} Tokens) reicht für diese Antwort nicht aus (≈ ${estimatedTokens} Tokens). Verkleinere das Kontextfenster${trial ? ", verbinde einen eigenen Zugang" : " oder upgrade deinen Tarif"}.`;
  }
  throw new UsageGuardError("quota_exceeded", message, 402);
}

/**
 * Vor jeder Agenten-Antwort: Kontingent (inkl. Schätzung) + Minutenlimit des Tarifs.
 * Router- und Summary-Aufrufe zählen nicht gegen das Minutenlimit (BF-25), nur gegen
 * das Kontingent – sie sind über das Rundenlimit begrenzt.
 */
export async function assertCanCallModel(
  profile: UserProfile,
  estimatedTokens: number,
  options: { ownAccess?: boolean; skipRateLimit?: boolean } = {},
): Promise<void> {
  // Eigener Zugang für genau dieses Modell (z. B. Anthropic-Key, lokales Abo): kein Kontingent.
  if (!options.ownAccess) assertQuota(profile, estimatedTokens);
  // Ratssitzung: der Start einer Runde ist rate-limitiert, die Antworten innerhalb der Runde zählen nicht einzeln.
  if (options.skipRateLimit) return;
  const rate = await rateLimit("model", profile.id, profile.rate_limit_per_min);
  if (!rate.allowed) {
    throw new UsageGuardError("rate_limited", rateLimitMessage(profile.rate_limit_per_min, rate), 429, rate.retryAfterMs);
  }
}
