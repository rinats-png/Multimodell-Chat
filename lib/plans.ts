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
  /** Gespeicherte Entscheidungsberichte (F-21). Beim Starter zählt die Erstellung nicht gegen den Testlauf, ist aber begrenzt. */
  maxReports: number;
  /** Langzeitgedächtnis (zusätzliche Summary-Aufrufe) */
  runningSummary: boolean;
}

export interface PlanDefinition {
  tier: SubscriptionTier;
  name: string;
  priceEur: number;
  /** Kontingent: bei bezahlten Tarifen je Monat, beim Starter einmalig (Testlauf, siehe `trialOnly`). */
  monthlyTokenLimit: number;
  /** Höchstverbrauch je Tag (UTC), schützt vor einem Ausreißer an einem einzelnen Tag. */
  dailyTokenLimit: number;
  /** Starter: das Kontingent ist ein einmaliger Testlauf mit dem Plattform-Key und wird nicht monatlich erneuert. */
  trialOnly: boolean;
  /** Agenten-Antworten pro Minute */
  rateLimitPerMin: number;
  /** Eigene Zugänge (OpenRouter, Gateway, Anbieter-Keys) erlaubt – derzeit in allen Tarifen. */
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
    monthlyTokenLimit: 60_000,
    dailyTokenLimit: 60_000,
    trialOnly: true,
    rateLimitPerMin: 5,
    byok: true,
    limits: { maxActiveAgents: 3, maxAutoTurns: 3, maxSlidingWindow: 12, maxRooms: 5, maxReports: 3, runningSummary: false },
    tagline: "Ein Testlauf zum Ausprobieren, danach mit eigenem Zugang.",
    features: [
      "Einmaliger Testlauf: etwa eine Debatte (60.000 Tokens) mit unserem Zugang",
      "Danach unbegrenzt mit eigenem Zugang: OpenRouter verbinden oder API-Keys",
      "5 KI-Antworten pro Minute",
      "3 KI-Agenten pro Raum, bis zu 5 Räume",
      "3 Entscheidungsberichte zum Teilen und Drucken",
      "Router, Round-Robin & @Mentions",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    priceEur: 29,
    monthlyTokenLimit: 500_000,
    dailyTokenLimit: 150_000,
    trialOnly: false,
    rateLimitPerMin: 15,
    byok: true,
    limits: { maxActiveAgents: 6, maxAutoTurns: 10, maxSlidingWindow: 40, maxRooms: 100, maxReports: 200, runningSummary: true },
    tagline: "Für tägliche Strategie- und Architektur-Debatten.",
    features: [
      "500.000 Tokens pro Monat inklusive",
      "Eigener Zugang ohne Token-Deckel",
      "15 KI-Antworten pro Minute",
      "Bis zu 6 Agenten pro Raum, 100 Räume",
      "Entscheidungsberichte als Link und PDF (bis 200)",
      "Agenten-Studio & Prompt-Inspector",
      "Langzeitgedächtnis (Running Summary)",
    ],
  },
  team: {
    tier: "team",
    name: "Workspace",
    priceEur: 79,
    monthlyTokenLimit: 2_500_000,
    dailyTokenLimit: 600_000,
    trialOnly: false,
    rateLimitPerMin: 60,
    byok: true,
    limits: { maxActiveAgents: 8, maxAutoTurns: 10, maxSlidingWindow: 40, maxRooms: 100, maxReports: 500, runningSummary: true },
    tagline: "Für Teams und Vielnutzer – volle Kostenkontrolle.",
    features: [
      "2,5 Mio. Tokens pro Monat inklusive",
      "60 KI-Antworten pro Minute",
      "Eigener Zugang: jedes Modell, kein Token-Deckel",
      "Bis zu 8 Agenten pro Raum",
      "Alles aus Pro",
    ],
  },
};

export const PLAN_ORDER: SubscriptionTier[] = ["free", "pro", "team"];

