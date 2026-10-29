import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const inserted: string[] = [];
const rpc = vi.fn();
const admin = {
  from: (table: string) => ({
    insert: async (row: { id: string }) => {
      if (table !== "billing_events") throw new Error("unexpected table");
      if (inserted.includes(row.id)) return { error: { code: "23505" } };
      inserted.push(row.id);
      return { error: null };
    },
    delete: () => ({ eq: async () => ({ error: null }) }),
  }),
  rpc,
};
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => admin }));

const { POST } = await import("@/app/api/billing/webhook/route");

const SECRET = "whsec_test_secret";
const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function signedRequest(event: object, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/billing/webhook", { method: "POST", headers: { "stripe-signature": header }, body: payload });
}

const subscriptionEvent = (id: string, type: string, status = "active") => ({
  id,
  object: "event",
  type,
  data: {
    object: {
      id: "sub_1",
      object: "subscription",
      customer: "cus_1",
      status,
      metadata: { userId: USER },
      items: { data: [{ price: { id: "price_pro" } }] },
    },
  },
});

beforeEach(() => {
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_PRO: "price_pro", STRIPE_PRICE_TEAM: "price_team" });
  inserted.length = 0;
  rpc.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => {
  for (const k of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PRO", "STRIPE_PRICE_TEAM"]) delete process.env[k];
});

describe("Stripe-Webhook (F-12)", () => {
  it("T-SEC-25: ungültige Signatur → 400, kein Tarifwechsel", async () => {
    const res = await POST(signedRequest(subscriptionEvent("evt_1", "customer.subscription.updated"), "whsec_falsch"));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("TEST-F12-2: gültiges Abo-Update setzt den Tarif serverseitig", async () => {
    const res = await POST(signedRequest(subscriptionEvent("evt_2", "customer.subscription.updated")));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_subscription_tier", expect.objectContaining({ p_user_id: USER, p_tier: "pro" }));
  });

  it("TEST-F12-3: Kündigung stuft auf Starter zurück; gleiche Event-ID wird nur einmal verarbeitet (T-SEC-25)", async () => {
    await POST(signedRequest(subscriptionEvent("evt_3", "customer.subscription.deleted")));
    await POST(signedRequest(subscriptionEvent("evt_3", "customer.subscription.deleted")));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("apply_subscription_tier", expect.objectContaining({ p_tier: "free" }));
  });

  it("nicht aktives Abo schaltet nichts frei", async () => {
    await POST(signedRequest(subscriptionEvent("evt_4", "customer.subscription.updated", "past_due")));
    expect(rpc).toHaveBeenCalledWith("apply_subscription_tier", expect.objectContaining({ p_tier: "free" }));
  });
});
