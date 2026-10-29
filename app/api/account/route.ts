import { assertSensitiveAction } from "@/lib/account";
import { handleApi } from "@/lib/api";
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
        await getStripe().subscriptions.cancel(data.stripe_subscription_id).catch((error) => logError("account.cancel_subscription", error));
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
