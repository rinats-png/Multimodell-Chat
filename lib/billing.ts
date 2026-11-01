import "server-only";
import Stripe from "stripe";
import type { SubscriptionTier } from "./types";

/**
 * Stripe-Anbindung. Preise und Freischaltung bestimmt nur der Server (Regel 8.1):
 * Der Client nennt einen Tarif, der Server wählt die Preis-ID aus der Konfiguration.
 */

let stripe: Stripe | null = null;

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_PRO && process.env.STRIPE_PRICE_TEAM);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  stripe ??= new Stripe(key);
  return stripe;
}

export function priceIdFor(tier: Exclude<SubscriptionTier, "free">): string {
  const id = tier === "pro" ? process.env.STRIPE_PRICE_PRO : process.env.STRIPE_PRICE_TEAM;
  if (!id) throw new Error(`Preis-ID für ${tier} fehlt`);
  return id;
}

export function tierForPriceId(priceId: string | null | undefined): SubscriptionTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_TEAM) return "team";
  return null;
}

/** Abo-Status → Tarif. Nur aktive (oder Testphase) Abos schalten frei. */
export function tierForSubscription(sub: Pick<Stripe.Subscription, "status" | "items">): SubscriptionTier {
  if (sub.status !== "active" && sub.status !== "trialing") return "free";
  return tierForPriceId(sub.items.data[0]?.price.id) ?? "free";
}

export function appOrigin(request: Request): string {
  return process.env.APP_ORIGIN ?? new URL(request.url).origin;
}
