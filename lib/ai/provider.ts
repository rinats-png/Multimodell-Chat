import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { PLANS } from "../plans";
import type { UserProfile } from "../types";

export type KeySource = "byok" | "platform" | "demo";

export interface ResolvedKey {
  source: KeySource;
  apiKey: string | null;
}

/** Ein BYOK-Wert zählt nur, wenn er nicht leer ist UND der Tarif BYOK erlaubt (BF-24). */
export function effectiveCustomKey(profile: Pick<UserProfile, "custom_openrouter_key" | "subscription_tier">): string | null {
  const key = profile.custom_openrouter_key?.trim();
  if (!key || !PLANS[profile.subscription_tier].byok) return null;
  return key;
}

/**
 * Einzige Stelle, die entscheidet, welcher Schlüssel bezahlt. Kontingentprüfung
 * und Modellaufruf nutzen dieselbe Funktion, damit sie sich nie widersprechen.
 */
export function resolveApiKey(
  profile: Pick<UserProfile, "custom_openrouter_key" | "subscription_tier">,
  options: { allowPlatformKey: boolean },
): ResolvedKey {
  const custom = effectiveCustomKey(profile);
  if (custom) return { source: "byok", apiKey: custom };
  const platform = process.env.OPENROUTER_API_KEY?.trim();
  if (platform && options.allowPlatformKey) return { source: "platform", apiKey: platform };
  return { source: "demo", apiKey: null };
}

export function getLanguageModel(modelId: string, apiKey: string): LanguageModel {
  const openrouter = createOpenRouter({
    apiKey,
    headers: { "X-Title": "Multimodell-Chat" },
  });
  // BF-17: Nur Anbieter, die Prompts nicht speichern bzw. nicht zum Training nutzen [Q-003].
  // Findet OpenRouter dafür keinen Anbieter, schlägt die Anfrage fehl (404) – siehe userFacingModelError.
  const dataCollection = process.env.OPENROUTER_DATA_COLLECTION === "allow" ? "allow" : "deny";
  return openrouter.chat(modelId, { provider: { data_collection: dataCollection } });
}

export const ROUTER_MODEL = process.env.ROUTER_MODEL || "google/gemini-2.5-flash";
export const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "openai/gpt-4o-mini";
