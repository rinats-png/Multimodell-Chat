import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const inserted: string[] = [];
const rpc = vi.fn();
const state = { storedSubscription: null as string | null, profileExists: true };
const liveSubs = new Map<string, { id: string; status: string; customer: string; items: { data: { price: { id: string } }[] } }>();

const admin = {
  from: (table: string) => {
    if (table === "billing_events") {
      return {
        insert: async (row: { id: string }) => {
          if (inserted.includes(row.id)) return { error: { code: "23505" } };
          inserted.push(row.id);
          return { error: null };
        },
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.profileExists ? { stripe_subscription_id: state.storedSubscription } : null, error: null }),
        }),
      }),
    };
  },
  rpc,
};
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => admin }));
vi.mock("@/lib/billing", async (original) => {
  const actual = await original<typeof import("@/lib/billing")>();
  return {
    ...actual,
    getStripe: () => ({
      webhooks: Stripe.webhooks,
      subscriptions: { retrieve: async (id: string) => liveSubs.get(id) },
    }),
  };
});

const { POST } = await import("@/app/api/billing/webhook/route");

const SECRET = "whsec_test_secret";

function signedRequest(event: object, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/billing/webhook", { method: "POST", headers: { "stripe-signature": header }, body: payload });
}

const subEvent = (id: string, type: string, subId = "sub_1", payloadStatus = "active") => ({
  id,
  object: "event",
  type,
  data: { object: { id: subId, object: "subscription", customer: "cus_1", status: payloadStatus, metadata: { userId: USER }, items: { data: [{ price: { id: "price_pro" } }] } } },
});
const live = (id: string, status: string, price = "price_pro") => liveSubs.set(id, { id, status, customer: "cus_1", items: { data: [{ price: { id: price } }] } });

beforeEach(() => {
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_PRO: "price_pro", STRIPE_PRICE_TEAM: "price_team" });
  inserted.length = 0;
  liveSubs.clear();
  state.storedSubscription = "sub_1";
  state.profileExists = true;
  rpc.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => {
  for (const k of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_PRO", "STRIPE_PRICE_TEAM"]) delete process.env[k];
});

describe("Stripe-Webhook (F-12)", () => {
  it("T-SEC-25: ungültige Signatur → 400, kein Tarifwechsel", async () => {
    live("sub_1", "active");
    const res = await POST(signedRequest(subEvent("evt_1", "customer.subscription.updated"), "whsec_falsch"));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("TEST-F12-2: Abo-Update setzt den Tarif nach dem LIVE-Zustand bei Stripe", async () => {
    live("sub_1", "active", "price_team");
    const res = await POST(signedRequest(subEvent("evt_2", "customer.subscription.updated")));
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_subscription_tier", expect.objectContaining({ p_user_id: USER, p_tier: "team" }));
  });

  it("TEST-F12-3: Kündigung stuft auf Starter zurück; gleiche Event-ID nur einmal (T-SEC-25)", async () => {
    live("sub_1", "canceled");
    await POST(signedRequest(subEvent("evt_3", "customer.subscription.deleted")));
    await POST(signedRequest(subEvent("evt_3", "customer.subscription.deleted")));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("apply_subscription_tier", expect.objectContaining({ p_tier: "free" }));
  });

  it("T-SEC-30: verspätetes 'updated'-Event mit veraltetem Inhalt schaltet ein gekündigtes Abo nicht frei", async () => {
    live("sub_1", "canceled");
    await POST(signedRequest(subEvent("evt_5", "customer.subscription.updated", "sub_1", "active")));
    expect(rpc).toHaveBeenCalledWith("apply_subscription_tier", expect.objectContaining({ p_tier: "free" }));
  });

  it("T-SEC-30: Events zu einem fremden oder alten Abo werden ignoriert", async () => {
    live("sub_alt", "active");
    await POST(signedRequest(subEvent("evt_6", "customer.subscription.updated", "sub_alt")));
    state.storedSubscription = null;
    await POST(signedRequest(subEvent("evt_7", "customer.subscription.updated", "sub_alt")));
    expect(rpc).not.toHaveBeenCalled();
  });
});
