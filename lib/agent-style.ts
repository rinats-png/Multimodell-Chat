import { providerOf, type ProviderKey } from "./models";

export interface AgentStyle {
  /** Hintergrund des Avatars */
  avatar: string;
  /** Akzentfarbe für Namen & Linien */
  text: string;
  ring: string;
  soft: string;
  dot: string;
}

const STYLES: Record<ProviderKey, AgentStyle> = {
  openai: {
    avatar: "bg-gradient-to-br from-openai to-openai/85 text-on-agent shadow-[0_0_18px_-4px_var(--color-openai)]",
    text: "text-openai",
    ring: "ring-openai/40",
    soft: "bg-openai/10 border-openai/25",
    dot: "bg-openai",
  },
  anthropic: {
    avatar: "bg-gradient-to-br from-anthropic to-anthropic/85 text-on-agent shadow-[0_0_18px_-4px_var(--color-anthropic)]",
    text: "text-anthropic",
    ring: "ring-anthropic/40",
    soft: "bg-anthropic/10 border-anthropic/25",
    dot: "bg-anthropic",
  },
  google: {
    avatar: "bg-gradient-to-br from-google to-google/85 text-on-agent shadow-[0_0_18px_-4px_var(--color-google)]",
    text: "text-google",
    ring: "ring-google/40",
    soft: "bg-google/10 border-google/25",
    dot: "bg-google",
  },
  other: {
    avatar: "bg-gradient-to-br from-other to-other/85 text-on-agent shadow-[0_0_18px_-4px_var(--color-other)]",
    text: "text-other",
    ring: "ring-other/40",
    soft: "bg-other/10 border-other/25",
    dot: "bg-other",
  },
};

export function agentStyle(modelId: string): AgentStyle {
  return STYLES[providerOf(modelId)];
}
