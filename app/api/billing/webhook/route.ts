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
 * Z14-04: Der Abo-Zustand wird nie aus dem Event-Inhalt übernommen, sondern immer frisch bei
 * Stripe abgefragt (Reihenfolge der Events ist nicht garantiert). Events zu einem anderen als
 * dem gespeicherten Abo werden ignoriert.
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
  // Bereits verarbeitet? → idempotent bestätigen. Das Ereignis wird erst NACH erfolgreicher Verarbeitung gemerkt:
  // Bricht die Funktion mittendrin ab (Zeitlimit, Absturz), liefert Stripe es erneut zu und der Tarif wird doch noch gesetzt.
  const { data: seen, error: seenError } = await admin.from("billing_events").select("id").eq("id", event.id).maybeSingle();
  if (seenError) {
    logError("webhook.idempotency", seenError);
    return new Response("error", { status: 500 });
  }
  if (seen) return new Response("ok", { status: 200 });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = uuidSchema.safeParse(session.client_reference_id).data;
      if (!userId || typeof session.subscription !== "string") throw new Error("Checkout ohne Nutzer-ID oder Abo");
      await syncSubscription(userId, session.subscription, { allowNew: true });
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const userId = uuidSchema.safeParse(sub.metadata?.userId).data;
      if (!userId) throw new Error("Abo ohne Nutzer-ID");
      await syncSubscription(userId, sub.id, { allowNew: false });
    }
  } catch (error) {
    // Nicht gemerkt: Stripe stellt das Ereignis erneut zu.
    logError("webhook", error, { type: event.type });
    return new Response("error", { status: 500 });
  }
  // syncSubscription liest den aktuellen Stand bei Stripe und ist daher wiederholbar; schlägt das Merken fehl,
  // läuft eine erneute Zustellung einfach noch einmal durch.
  const { error: recordError } = await admin.from("billing_events").insert({ id: event.id, type: event.type });
  if (recordError && recordError.code !== "23505") logError("webhook.record", recordError);
  return new Response("ok", { status: 200 });
}

async function syncSubscription(userId: string, subscriptionId: string, options: { allowNew: boolean }): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .maybeSingle<{ stripe_subscription_id: string | null }>();
  if (error) throw new Error(`Profil laden: ${error.message}`);
  if (!profile) return; // Konto gelöscht – nichts zu tun

  const current = profile.stripe_subscription_id;
  if (current && current !== subscriptionId) {
    securityLog("webhook_foreign_subscription_ignored", { userId });
    return;
  }
  if (!current && !options.allowNew) return; // altes/unbekanntes Abo darf keinen Tarif setzen

  const sub = await getStripe().subscriptions.retrieve(subscriptionId);
  const tier = tierForSubscription(sub);
  const { error: rpcError } = await admin.rpc("apply_subscription_tier", {
    p_user_id: userId,
    p_tier: tier,
    p_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    p_subscription_id: sub.id,
  });
  if (rpcError) throw new Error(`Tarif setzen: ${rpcError.message}`);
  securityLog("subscription_tier_applied", { userId, tier });
}
