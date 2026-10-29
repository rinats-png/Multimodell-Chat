import { NextResponse } from "next/server";
import { appOrigin, getStripe, isBillingConfigured } from "@/lib/billing";
import { handleApi, HttpError, limitMutations } from "@/lib/api";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Stripe-Kundenportal: Abo kündigen, Zahlungsmittel ändern, Rechnungen. */
export async function POST(request: Request) {
  return handleApi(async () => {
    const { userId, isDemoStore } = await getSession();
    await limitMutations(userId);
    if (isDemoStore || !isBillingConfigured()) throw new HttpError(503, "billing_not_configured", "Die Bezahlung ist noch nicht eingerichtet.");
    const { data } = await getSupabaseAdmin().from("user_profiles").select("stripe_customer_id").eq("id", userId).single<{ stripe_customer_id: string | null }>();
    if (!data?.stripe_customer_id) throw new HttpError(404, "no_subscription", "Es gibt noch kein Abo zu verwalten.");
    const portal = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${appOrigin(request)}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  });
}
