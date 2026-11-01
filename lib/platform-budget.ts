import type { ResolvedKey } from "./ai/provider";
import { logError } from "./log";
import { estimateCostUsd } from "./models";
import type { DataStore } from "./store/types";
import type { UserProfile } from "./types";
import { UsageGuardError } from "./usage-guard";

/**
 * Gemeinsame Ausgabenobergrenze für den Plattform-Key (OPENROUTER_API_KEY), Beschluss des Roast Room.
 * Die App schätzt die Kosten jedes Aufrufs (lib/models.ts), bucht sie in `platform_spend` (Migration 0008) und
 * verweigert weitere Aufrufe mit dem Plattform-Key, sobald die Grenze erreicht ist. Eigene Zugänge zählen nicht.
 *
 * Zwei Töpfe: Testnutzer (Starter) dürfen nur einen Anteil der Grenze verbrauchen, damit sie den Rest nicht
 * aufbrauchen können, den zahlende Kunden brauchen.
 */
export interface PlatformSpend {
  trial_usd: number;
  paid_usd: number;
}

export interface PlatformBudget {
  /** Obergrenze für alle Aufrufe mit dem Plattform-Key im Monat, in USD. */
  totalUsd: number;
  /** Davon höchstens für Testnutzer (Starter), in USD. */
  trialUsd: number;
}

export const DEFAULT_MONTHLY_CAP_EUR = 50;
/** Anteil der Obergrenze, den Testnutzer verbrauchen dürfen. */
export const DEFAULT_TRIAL_SHARE = 0.4;
/** Umrechnung EUR → USD, konservativ hoch angesetzt (die Schätzungen sind in USD). */
export const DEFAULT_USD_PER_EUR = 1.1;

function numberFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

/** Grenzwerte aus der Umgebung; ungültige oder fehlende Werte fallen auf die sicheren Standardwerte zurück. */
export function platformBudget(): PlatformBudget {
  const capEur = numberFromEnv("PLATFORM_KEY_MONTHLY_CAP_EUR", DEFAULT_MONTHLY_CAP_EUR, 0, 100_000);
  const share = numberFromEnv("PLATFORM_KEY_TRIAL_SHARE", DEFAULT_TRIAL_SHARE, 0, 1);
  const usdPerEur = numberFromEnv("PLATFORM_KEY_USD_PER_EUR", DEFAULT_USD_PER_EUR, 0.1, 10);
  const totalUsd = capEur * usdPerEur;
  return { totalUsd, trialUsd: totalUsd * share };
}

export const isTrialUser = (profile: Pick<UserProfile, "subscription_tier">): boolean => profile.subscription_tier === "free";

/** Reine Prüfung: Darf dieser Nutzer mit dem Plattform-Key noch etwas verbrauchen? */
export function platformBudgetAllows(spend: PlatformSpend, profile: Pick<UserProfile, "subscription_tier">, budget: PlatformBudget = platformBudget()): boolean {
  if (spend.trial_usd + spend.paid_usd >= budget.totalUsd) return false;
  if (isTrialUser(profile) && spend.trial_usd >= budget.trialUsd) return false;
  return true;
}

export const BUDGET_EXHAUSTED_MESSAGE =
  "Der gemeinsame Zugang ist für diesen Monat ausgeschöpft. Verbinde dein OpenRouter-Konto oder hinterlege einen eigenen API-Key unter „Tarif & Verbrauch“, dann geht es sofort weiter.";

/** Nicht werfende Variante für Router, Bewertung und Zusammenfassung: dort gibt es einen Ersatz ohne Modellaufruf. */
export async function platformBudgetOk(store: Pick<DataStore, "getPlatformSpend">, profile: Pick<UserProfile, "subscription_tier">): Promise<boolean> {
  return platformBudgetAllows(await store.getPlatformSpend(), profile);
}

/** Vor einer Antwort mit dem Plattform-Key: wirft, wenn die Obergrenze erreicht ist (harter Stopp). */
export async function assertPlatformBudget(store: Pick<DataStore, "getPlatformSpend">, profile: Pick<UserProfile, "subscription_tier">): Promise<void> {
  if (!(await platformBudgetOk(store, profile))) {
    throw new UsageGuardError("budget_exhausted", BUDGET_EXHAUSTED_MESSAGE, 503);
  }
}

/**
 * Bucht die geschätzten Kosten eines Aufrufs mit dem Plattform-Key gegen die gemeinsame Obergrenze.
 * Eigene Zugänge und Demo kosten nichts. Ein Fehler beim Buchen beendet den Vorgang nicht, wird aber protokolliert.
 */
export async function bookPlatformSpend(
  store: Pick<DataStore, "addPlatformSpend">,
  profile: Pick<UserProfile, "id" | "subscription_tier">,
  access: Pick<ResolvedKey, "source">,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  if (access.source !== "platform") return;
  const cost = estimateCostUsd(modelId, inputTokens, outputTokens);
  if (cost <= 0) return;
  await store.addPlatformSpend(cost, isTrialUser(profile)).catch((e) => logError("platform.spend", e, { userId: profile.id }));
}
