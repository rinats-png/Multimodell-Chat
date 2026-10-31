import { isLocalSubscriptionMode } from "@/lib/ai/local-cli";
import { isBillingConfigured } from "@/lib/billing";
import { getSession, toPublicProfile } from "@/lib/session";
import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; verbunden?: string; verbindung?: string }> }) {
  const { store, email, isDemoStore } = await getSession();
  const [profile, totals] = await Promise.all([store.getProfile(), store.getUsageTotals()]);
  const publicProfile = toPublicProfile(profile);
  const { checkout, verbunden, verbindung } = await searchParams;

  return (
    <AppShell email={email} isDemoStore={isDemoStore} active="billing">
      <BillingDashboard
        profile={publicProfile}
        totals={totals}
        isDemoStore={isDemoStore}
        billingConfigured={isBillingConfigured()}
        checkoutState={checkout === "success" || checkout === "cancelled" ? checkout : null}
        connectState={verbunden === "openrouter" ? "connected" : verbindung === "fehler" ? "failed" : null}
        localMode={isLocalSubscriptionMode()}
      />
    </AppShell>
  );
}
