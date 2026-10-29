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
  { id: "openai/gpt-4o", label: "GPT-4o", inputPer1k: 0.0025, outputPer1k: 0.01 },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", inputPer1k: 0.00015, outputPer1k: 0.0006 },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", inputPer1k: 0.003, outputPer1k: 0.015 },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", inputPer1k: 0.0008, outputPer1k: 0.004 },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", inputPer1k: 0.00125, outputPer1k: 0.01 },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", inputPer1k: 0.0003, outputPer1k: 0.0025 },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", inputPer1k: 0.00013, outputPer1k: 0.0004 },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3", inputPer1k: 0.0003, outputPer1k: 0.00088 },
];

/** Fallback-Tarif für frei eingetragene Modell-IDs (konservativ hoch angesetzt). */
const FALLBACK_PRICING: Pick<ModelInfo, "inputPer1k" | "outputPer1k"> = {
  inputPer1k: 0.003,
  outputPer1k: 0.015,
};

export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODEL_CATALOG.find((m) => m.id === modelId);
}

export function estimateCostUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelInfo(modelId) ?? FALLBACK_PRICING;
  const cost = (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export type ProviderKey = "openai" | "anthropic" | "google" | "other";

export function providerOf(modelId: string): ProviderKey {
  const prefix = modelId.split("/")[0];
  if (prefix === "openai" || prefix === "anthropic" || prefix === "google") return prefix;
  return "other";
}

/** Grobe Token-Schätzung (≈ 4 Zeichen pro Token), nur für Vorschau & Demo-Modus. */
export function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
