import type Stripe from "stripe";
import { getStripe, isBillingConfigured, tierForSubscription } from "@/lib/billing";
import { logError, securityLog } from "@/lib/log";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Stripe-Webhook (Regel 8.2): Signatur + Zeitstempel (Toleranz 300 s, Stripe-Standard)
 * über `constructEvent`, idempotent über die Tabelle billing_events.
 */
export async function POST(request: Request) {
  if (!isBillingConfigured()) return new Response("not configured", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();
  if (!signature || body.length > MAX_BODY_BYTES) return new Response("bad request", { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    securityLog("webhook_signature_invalid");
    return new Response("invalid signature", { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error: dupError } = await admin.from("billing_events").insert({ id: event.id, type: event.type });
  if (dupError) {
    // 23505 = bereits verarbeitet → idempotent bestätigen
    if (dupError.code === "23505") return new Response("ok", { status: 200 });
    logError("webhook.idempotency", dupError);
    return new Response("error", { status: 500 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = uuidSchema.safeParse(session.client_reference_id).data;
      if (!userId || typeof session.subscription !== "string") throw new Error("Checkout ohne Nutzer-ID oder Abo");
      const sub = await getStripe().subscriptions.retrieve(session.subscription);
      await applyTier(userId, tierForSubscription(sub), String(session.customer), sub.id);
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const userId = uuidSchema.safeParse(sub.metadata?.userId).data;
      if (!userId) throw new Error("Abo ohne Nutzer-ID");
      const tier = event.type === "customer.subscription.deleted" ? "free" : tierForSubscription(sub);
      await applyTier(userId, tier, String(sub.customer), sub.id);
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    // Event wieder freigeben, damit Stripe es erneut zustellen kann.
    await admin.from("billing_events").delete().eq("id", event.id);
    logError("webhook", error, { type: event.type });
    return new Response("error", { status: 500 });
  }
}

async function applyTier(userId: string, tier: string, customerId: string, subscriptionId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().rpc("apply_subscription_tier", {
    p_user_id: userId,
    p_tier: tier,
    p_customer_id: customerId,
    p_subscription_id: subscriptionId,
  });
  if (error) throw new Error(`Tarif setzen: ${error.message}`);
  securityLog("subscription_tier_applied", { userId, tier });
}
