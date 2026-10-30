import { assertSensitiveAction } from "@/lib/account";
import { handleApi, HttpError } from "@/lib/api";
import { getStripe, isBillingConfigured } from "@/lib/billing";
import { logError, securityLog } from "@/lib/log";
import { getSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Konto endgültig löschen (DSGVO Art. 17, Regel 7.3): Abo kündigen, alle Daten löschen, abmelden. */
export async function DELETE() {
  return handleApi(async () => {
    const session = await getSession();
    await assertSensitiveAction(session);

    if (!session.isDemoStore && isBillingConfigured()) {
      const { data } = await getSupabaseAdmin()
        .from("user_profiles")
        .select("stripe_subscription_id")
        .eq("id", session.userId)
        .single<{ stripe_subscription_id: string | null }>();
      if (data?.stripe_subscription_id) {
        // Z14-05: Ohne erfolgreiche Kündigung wird das Konto NICHT gelöscht (sonst zahlt der Kunde weiter).
        try {
          const sub = await getStripe().subscriptions.retrieve(data.stripe_subscription_id);
          if (sub.status !== "canceled") await getStripe().subscriptions.cancel(sub.id);
        } catch (error) {
          logError("account.cancel_subscription", error, { userId: session.userId });
          throw new HttpError(502, "cancel_failed", "Dein Abo konnte gerade nicht gekündigt werden. Das Konto wurde nicht gelöscht – bitte später erneut versuchen.");
        }
      }
    }

    await session.store.deleteAccount();
    securityLog("account_deleted", { userId: session.userId });
    if (!session.isDemoStore) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
    return new Response(null, { status: 204 });
  });
}
