import type { SubscriptionTier } from "./types";

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  priceEur: number;
  monthlyTokenLimit: number;
  rateLimitPerMin: number;
  byok: boolean;
  tagline: string;
  features: string[];
}

export const PLANS: Record<SubscriptionTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Starter",
    priceEur: 0,
    monthlyTokenLimit: 15_000,
    rateLimitPerMin: 5,
    byok: false,
    tagline: "Zum Ausprobieren der ersten KI-Debatten.",
    features: [
      "15.000 Tokens pro Monat",
      "5 Anfragen pro Minute",
      "3 KI-Agenten pro Raum",
      "Router, Round-Robin & @Mentions",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceEur: 29,
    monthlyTokenLimit: 500_000,
    rateLimitPerMin: 15,
    byok: false,
    tagline: "Für tägliche Strategie- und Architektur-Debatten.",
    features: [
      "500.000 Tokens pro Monat",
      "15 Anfragen pro Minute",
      "Unbegrenzte Räume & Agenten",
      "Agenten-Studio & Prompt-Inspector",
      "Langzeitgedächtnis (Running Summary)",
    ],
  },
  team: {
    tier: "team",
    name: "Workspace / BYOK",
    priceEur: 79,
    monthlyTokenLimit: 2_500_000,
    rateLimitPerMin: 60,
    byok: true,
    tagline: "Eigener OpenRouter-Key, volle Kostenkontrolle.",
    features: [
      "2,5 Mio. Tokens pro Monat inklusive",
      "60 Anfragen pro Minute",
      "Bring Your Own OpenRouter Key",
      "Mit eigenem Key kein Token-Deckel",
      "Alles aus Pro",
    ],
  },
};

export const PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "team"];
