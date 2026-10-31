export interface ModelInfo {
  id: string;
  label: string;
  /** USD pro 1.000 Input-Tokens */
  inputPer1k: number;
  /** USD pro 1.000 Output-Tokens */
  outputPer1k: number;
}

/** Tarife (Stand OpenRouter-Listenpreise) für die Echtzeit-Kostenkalkulation. */
export const MODEL_CATALOG: ModelInfo[] = [
  { id: "openai/gpt-5", label: "GPT-5", inputPer1k: 0.00125, outputPer1k: 0.01 },
  { id: "openai/gpt-5-mini", label: "GPT-5 mini", inputPer1k: 0.00025, outputPer1k: 0.002 },
  { id: "openai/gpt-4o", label: "GPT-4o", inputPer1k: 0.0025, outputPer1k: 0.01 },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", inputPer1k: 0.00015, outputPer1k: 0.0006 },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", inputPer1k: 0.003, outputPer1k: 0.015 },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", inputPer1k: 0.001, outputPer1k: 0.005 },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", inputPer1k: 0.00125, outputPer1k: 0.01 },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", inputPer1k: 0.0003, outputPer1k: 0.0025 },
  { id: "x-ai/grok-4", label: "Grok 4", inputPer1k: 0.003, outputPer1k: 0.015 },
  { id: "moonshotai/kimi-k2", label: "Kimi K2", inputPer1k: 0.0006, outputPer1k: 0.0025 },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", inputPer1k: 0.00013, outputPer1k: 0.0004 },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3", inputPer1k: 0.0003, outputPer1k: 0.00088 },
];

/**
 * Lokaler Abo-Modus: Modelle, die über die Kommandozeilen-Programme der Anbieter laufen
 * (siehe lib/ai/local-cli.ts). Keine Kosten in der App – es zählt dein Abo.
 */
export const ABO_MODEL_LIST: { id: string; label: string; provider: ProviderKey }[] = [
  { id: "abo/chatgpt", label: "ChatGPT · eigenes Abo (Codex CLI)", provider: "openai" },
  { id: "abo/claude", label: "Claude · eigenes Abo (Claude Code)", provider: "anthropic" },
  { id: "abo/gemini", label: "Gemini · eigenes Konto (Gemini CLI)", provider: "google" },
  { id: "abo/kimi", label: "Kimi · eigenes Abo (Kimi CLI)", provider: "other" },
];

/** Fallback-Tarif für frei eingetragene Modell-IDs (konservativ hoch angesetzt). */
const FALLBACK_PRICING: Pick<ModelInfo, "inputPer1k" | "outputPer1k"> = {
  inputPer1k: 0.003,
  outputPer1k: 0.015,
};

/**
 * Mit dem Plattform-Key sind nur Modelle aus dem Katalog erlaubt (BF-02) – das
 * Kontingent zählt Tokens, nicht Euro. Beliebige Modelle nur mit eigenem Key (BYOK).
 */
export function isPlatformModel(modelId: string): boolean {
  return MODEL_CATALOG.some((m) => m.id === modelId);
}

/** Obergrenze für generierte Tokens pro Agenten-Antwort. */
export const MAX_OUTPUT_TOKENS = 700;

function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

export function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  if (modelId.startsWith("abo/")) return 0;
  const pricing = getModelInfo(modelId) ?? FALLBACK_PRICING;
  const cost = (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export type ProviderKey = "openai" | "anthropic" | "google" | "other";

export function providerOf(modelId: string): ProviderKey {
  const abo = ABO_MODEL_LIST.find((m) => m.id === modelId);
  if (abo) return abo.provider;
  const prefix = modelId.split("/")[0];
  if (prefix === "openai" || prefix === "anthropic" || prefix === "google") return prefix;
  return "other";
}

/** Grobe Token-Schätzung (≈ 4 Zeichen pro Token), nur für Vorschau & Demo-Modus. */
export function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
