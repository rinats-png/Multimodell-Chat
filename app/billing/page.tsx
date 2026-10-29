import { getSession, toPublicProfile } from "@/lib/session";
import { BillingDashboard } from "@/components/billing/BillingDashboard";
import { Sidebar } from "@/components/shell/Sidebar";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { store, email, isDemoStore } = await getSession();
  const [profile, rooms] = await Promise.all([store.getProfile(), store.listRooms()]);
  const publicProfile = toPublicProfile(profile);

  // Verbrauch & Kosten über alle Räume (Ledger)
  const ledger = await Promise.all(
    rooms.map(async (room) => {
      const messages = await store.listMessages(room.id);
      return messages.reduce(
        (acc, m) => ({
          input: acc.input + m.input_tokens,
          output: acc.output + m.output_tokens,
          cost: acc.cost + m.estimated_cost_usd,
          replies: acc.replies + (m.sender_type === "agent" ? 1 : 0),
        }),
        { input: 0, output: 0, cost: 0, replies: 0 },
      );
    }),
  );
  const totals = ledger.reduce(
    (acc, r) => ({
      input: acc.input + r.input,
      output: acc.output + r.output,
      cost: acc.cost + r.cost,
      replies: acc.replies + r.replies,
    }),
    { input: 0, output: 0, cost: 0, replies: 0 },
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar rooms={rooms} profile={publicProfile} email={email} isDemoStore={isDemoStore} active="billing" />
      <main className="flex-1 overflow-y-auto">
        <BillingDashboard profile={publicProfile} totals={totals} isDemoStore={isDemoStore} />
      </main>
    </div>
  );
}
