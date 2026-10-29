import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

/** Liefert den zu verwendenden OpenRouter-Key: BYOK hat Vorrang vor dem Plattform-Key. */
export function resolveApiKey(customKey: string | null | undefined): string | null {
  return customKey?.trim() || process.env.OPENROUTER_API_KEY?.trim() || null;
}

export function isDemoMode(customKey: string | null | undefined): boolean {
  return resolveApiKey(customKey) === null;
}

export function getLanguageModel(modelId: string, apiKey: string): LanguageModel {
  const openrouter = createOpenRouter({
    apiKey,
    headers: { "X-Title": "Multimodell-Chat" },
  });
  return openrouter.chat(modelId);
}

export const ROUTER_MODEL = process.env.ROUTER_MODEL || "google/gemini-2.5-flash";
export const SUMMARY_MODEL = process.env.SUMMARY_MODEL || "openai/gpt-4o-mini";
