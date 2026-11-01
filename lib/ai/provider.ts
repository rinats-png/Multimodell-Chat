import { createAnthropic } from "@ai-sdk/anthropic";
import { createGateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { PLANS } from "../plans";
import type { ProviderKeyId, UserProfile } from "../types";
import { createCliModel, isAboModel, isLocalSubscriptionMode } from "./local-cli";

/**
 * Woher ein Modellaufruf seinen Zugang bekommt:
 * - "byok": eigener OpenRouter-Key (alle Modelle)
 * - "gateway" / "openai" / "anthropic" / "google" / "xai": weitere eigene Keys
 * - "local": lokaler Abo-Modus (CLI-Programme auf dem eigenen Rechner, kein Key)
 * - "platform": OpenRouter-Key des Betreibers (Kontingent zählt)
 * - "demo": simulierte Antworten
 */
export type KeySource = "byok" | ProviderKeyId | "local" | "platform" | "demo";

export interface ResolvedKey {
  source: KeySource;
  apiKey: string | null;
}

type KeyProfile = Pick<UserProfile, "custom_openrouter_key" | "subscription_tier"> & Partial<Pick<UserProfile, "provider_keys">>;

/** Ein BYOK-Wert zählt nur, wenn er nicht leer ist UND der Tarif BYOK erlaubt (BF-24). */
export function effectiveCustomKey(profile: KeyProfile): string | null {
  const key = profile.custom_openrouter_key?.trim();
  if (!key || !PLANS[profile.subscription_tier].byok) return null;
  return key;
}

/** Weiterer eigener Key (ohne Leerzeichen-Werte, nur wenn der Tarif BYOK erlaubt). */
export function effectiveProviderKey(profile: KeyProfile, id: ProviderKeyId): string | null {
  const key = profile.provider_keys?.[id]?.trim();
  if (!key || !PLANS[profile.subscription_tier].byok) return null;
  return key;
}

/** Deckt ein eigener Zugang jedes Modell ab? Dann gilt kein Token-Kontingent. */
export function hasUniversalOwnAccess(profile: KeyProfile): boolean {
  return Boolean(effectiveCustomKey(profile) || effectiveProviderKey(profile, "gateway"));
}

export function isOwnAccess(source: KeySource): boolean {
  return source !== "platform" && source !== "demo";
}

/** Direkter Anbieter-Key für ein Modell, z. B. "anthropic/…" → Anthropic-Key. */
function directProviderFor(modelId: string): ProviderKeyId | null {
  const prefix = modelId.split("/")[0];
  if (prefix === "openai" || prefix === "anthropic" || prefix === "google") return prefix;
  if (prefix === "x-ai" || prefix === "xai") return "xai";
  return null;
}

/**
 * Einzige Stelle, die entscheidet, welcher Zugang ein Modell bezahlt. Kontingentprüfung
 * und Modellaufruf nutzen dieselbe Funktion, damit sie sich nie widersprechen.
 * Reihenfolge: Abo-Modus → direkter Anbieter-Key → OpenRouter → Gateway → Plattform → Demo.
 */
export function resolveModelAccess(profile: KeyProfile, modelId: string, options: { allowPlatformKey: boolean }): ResolvedKey {
  if (isAboModel(modelId)) {
    return isLocalSubscriptionMode() ? { source: "local", apiKey: null } : { source: "demo", apiKey: null };
  }
  const direct = directProviderFor(modelId);
  const directKey = direct ? effectiveProviderKey(profile, direct) : null;
  if (direct && directKey) return { source: direct, apiKey: directKey };
  const openrouter = effectiveCustomKey(profile);
  if (openrouter) return { source: "byok", apiKey: openrouter };
  const gateway = effectiveProviderKey(profile, "gateway");
  if (gateway) return { source: "gateway", apiKey: gateway };
  const platform = process.env.OPENROUTER_API_KEY?.trim();
  if (platform && options.allowPlatformKey) return { source: "platform", apiKey: platform };
  return { source: "demo", apiKey: null };
}

/** Zugang ohne Modellbezug (OpenRouter-Key, sonst Plattform, sonst Demo). */
export function resolveApiKey(profile: KeyProfile, options: { allowPlatformKey: boolean }): ResolvedKey {
  return resolveModelAccess({ ...profile, provider_keys: {} }, "openrouter/auto", options);
}

/** Anthropic schreibt Versionen mit Bindestrich (claude-sonnet-4-5), OpenRouter mit Punkt (4.5). */
export function nativeModelId(modelId: string, provider: ProviderKeyId): string {
  const name = modelId.slice(modelId.indexOf("/") + 1);
  if (provider === "anthropic") return name.replace(/(\d)\.(\d)/g, "$1-$2");
  return name;
}

export function getLanguageModel(modelId: string, access: ResolvedKey): LanguageModel {
  if (access.source === "local") return createCliModel(modelId);
  const apiKey = access.apiKey;
  if (!apiKey) throw new Error("Kein Zugang für dieses Modell");
  switch (access.source) {
    case "openai":
      return createOpenAI({ apiKey })(nativeModelId(modelId, "openai"));
    case "anthropic":
      return createAnthropic({ apiKey })(nativeModelId(modelId, "anthropic"));
    case "google":
      return createGoogleGenerativeAI({ apiKey })(nativeModelId(modelId, "google"));
    case "xai":
      return createXai({ apiKey })(nativeModelId(modelId, "xai"));
    case "gateway":
      return createGateway({ apiKey })(modelId);
    default: {
      const openrouter = createOpenRouter({
        apiKey,
        headers: { "X-Title": "SynthrAI" },
      });
      // BF-17: Nur Anbieter, die Prompts nicht speichern bzw. nicht zum Training nutzen [Q-003].
      // Findet OpenRouter dafür keinen Anbieter, schlägt die Anfrage fehl (404) – siehe userFacingModelError.
      const dataCollection = process.env.OPENROUTER_DATA_COLLECTION === "allow" ? "allow" : "deny";
      return openrouter.chat(modelId, { provider: { data_collection: dataCollection } });
    }
  }
}

export const ROUTER_MODEL = process.env.ROUTER_MODEL || "google/gemini-2.5-flash";
export const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "openai/gpt-4o-mini";
