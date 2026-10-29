import type { SubscriptionTier } from "./types";

export interface PlanLimits {
  /** Aktive Agenten, die pro Raum antworten dürfen */
  maxActiveAgents: number;
  /** Höchstwert für Max-Auto-Turns */
  maxAutoTurns: number;
  /** Höchstwert für das Sliding Window */
  maxSlidingWindow: number;
  /** Anzahl Räume */
  maxRooms: number;
  /** Langzeitgedächtnis (zusätzliche Summary-Aufrufe) */
  runningSummary: boolean;
}

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  priceEur: number;
  monthlyTokenLimit: number;
  /** Agenten-Antworten pro Minute */
  rateLimitPerMin: number;
  byok: boolean;
  limits: PlanLimits;
  tagline: string;
  features: string[];
}

/**
 * Tarife – einzige Quelle für Preise, Limits und Funktionen. Der Server setzt sie
 * durch (BF-28); die Datenbank-Funktion `apply_subscription_tier` spiegelt die
 * Token- und Minutenwerte (Test: tests/plans.test.ts).
 */
export const PLANS: Record<SubscriptionTier, PlanDefinition> = {
  free: {
    tier: "free",
    name: "Starter",
    priceEur: 0,
    monthlyTokenLimit: 15_000,
    rateLimitPerMin: 5,
    byok: false,
    limits: { maxActiveAgents: 3, maxAutoTurns: 3, maxSlidingWindow: 12, maxRooms: 5, runningSummary: false },
    tagline: "Zum Ausprobieren der ersten KI-Debatten.",
    features: [
      "15.000 Tokens pro Monat",
      "5 KI-Antworten pro Minute",
      "3 KI-Agenten pro Raum, bis zu 5 Räume",
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
    limits: { maxActiveAgents: 6, maxAutoTurns: 10, maxSlidingWindow: 40, maxRooms: 100, runningSummary: true },
    tagline: "Für tägliche Strategie- und Architektur-Debatten.",
    features: [
      "500.000 Tokens pro Monat",
      "15 KI-Antworten pro Minute",
      "Bis zu 6 Agenten pro Raum, 100 Räume",
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
    limits: { maxActiveAgents: 8, maxAutoTurns: 10, maxSlidingWindow: 40, maxRooms: 100, runningSummary: true },
    tagline: "Eigener OpenRouter-Key, volle Kostenkontrolle.",
    features: [
      "2,5 Mio. Tokens pro Monat inklusive",
      "60 KI-Antworten pro Minute",
      "Bring Your Own OpenRouter Key – dann jedes Modell und kein Token-Deckel",
      "Bis zu 8 Agenten pro Raum",
      "Alles aus Pro",
    ],
  },
};

export const PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "team"];

export function planOf(tier: SubscriptionTier): PlanDefinition {
  return PLANS[tier];
}
