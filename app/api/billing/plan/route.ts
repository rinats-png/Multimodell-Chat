import { NextResponse } from "next/server";
import { appOrigin, getStripe, isBillingConfigured, priceIdFor } from "@/lib/billing";
import { handleApi, HttpError, limitMutations, readJson } from "@/lib/api";
import { isProduction } from "@/lib/env";
import { getSession, toPublicProfile } from "@/lib/session";
import { planSchema } from "@/lib/validation";

/**
 * Tarifwechsel.
 * - Demo-Workspace (nur Entwicklung): sofort, ohne Zahlung.
 * - Produktion: Stripe-Checkout mit Nutzer-ID; freigeschaltet wird erst per Webhook.
 */
export async function POST(request: Request) {
  return handleApi(async () => {
    const { store, userId, email, isDemoStore } = await getSession();
    await limitMutations(userId);
    const { tier } = await readJson(request, planSchema);

    if (isDemoStore) {
      if (isProduction() || !store.setTier) throw new HttpError(403, "forbidden", "Tarifwechsel ohne Zahlung ist nur lokal möglich.");
      return NextResponse.json({ profile: toPublicProfile(await store.setTier(tier)) });
    }
    if (!isBillingConfigured()) throw new HttpError(503, "billing_not_configured", "Die Bezahlung ist noch nicht eingerichtet.");
    if (tier === "free") throw new HttpError(400, "use_portal", "Zum Kündigen nutze „Abo verwalten“.");

    const origin = appOrigin(request);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceIdFor(tier), quantity: 1 }],
      client_reference_id: userId,
      customer_email: email ?? undefined,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });
    if (!session.url) throw new Error("Checkout-URL fehlt");
    return NextResponse.json({ checkoutUrl: session.url });
  });
}
