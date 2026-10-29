import { isBillingConfigured } from "@/lib/billing";
import { getSession, toPublicProfile } from "@/lib/session";
import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { store, email, isDemoStore } = await getSession();
  const [profile, rooms, totals] = await Promise.all([store.getProfile(), store.listRooms(), store.getUsageTotals()]);
  const publicProfile = toPublicProfile(profile);
  const { checkout } = await searchParams;

  return (
    <AppShell rooms={rooms} profile={publicProfile} email={email} isDemoStore={isDemoStore} active="billing" title="Tarif & Verbrauch">
      <BillingDashboard
        profile={publicProfile}
        totals={totals}
        isDemoStore={isDemoStore}
        billingConfigured={isBillingConfigured()}
        checkoutState={checkout === "success" || checkout === "cancelled" ? checkout : null}
      />
    </AppShell>
  );
}
