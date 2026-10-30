import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createSupabaseStore } from "@/lib/store/supabase-store";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Minimaler Query-Builder-Fake: protokolliert jede Kette und liefert vorgegebene Ergebnisse. */
function fakeClient(results: Record<string, unknown>) {
  const calls: string[] = [];
  const builder = (table: string) => {
    const chain: string[] = [`from(${table})`];
    const api: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "delete", "eq", "order", "limit", "returns"]) {
      api[m] = (...args: unknown[]) => {
        chain.push(`${m}(${JSON.stringify(args)})`);
        return api;
      };
    }
    const finish = async () => {
      calls.push(chain.join("."));
      return (results[table] as object) ?? { data: null, error: null };
    };
    api.maybeSingle = finish;
    api.single = finish;
    api.then = (resolve: (v: unknown) => void) => finish().then(resolve);
    return api;
  };
  const rpc = async (fn: string, args: unknown) => {
    calls.push(`rpc(${fn},${JSON.stringify(args)})`);
    return { data: 1, error: null };
  };
  return { client: { from: builder, rpc } as unknown as SupabaseClient, calls };
}

const message = {
  room_id: "b0000000-0000-4000-8000-00000000000b",
  sender_type: "agent" as const,
  agent_id: null,
  sender_name: "X",
  content: "x",
  input_tokens: 1,
  output_tokens: 1,
  estimated_cost_usd: 0,
};

describe("Supabase-Store: Service-Role nur nach Besitzprüfung (Z14-16)", () => {
  it("T-SEC-34: Ledger-Eintrag in fremden Raum → Abbruch, Service-Role schreibt nichts", async () => {
    const user = fakeClient({ chat_rooms: { data: null, error: null } }); // RLS: Raum nicht sichtbar
    const admin = fakeClient({ messages: { data: { id: "m" }, error: null } });
    const store = createSupabaseStore(user.client, admin.client, USER);
    await expect(store.insertMessage(message)).rejects.toThrow("Raum nicht gefunden");
    expect(admin.calls).toHaveLength(0);
    expect(user.calls[0]).toContain("from(chat_rooms)");
  });

  it("T-SEC-34: Gedächtnis schreiben filtert zusätzlich auf user_id; Verbrauch nur für die eigene ID", async () => {
    const user = fakeClient({ chat_rooms: { data: { id: message.room_id }, error: null } });
    const admin = fakeClient({ chat_rooms: { data: null, error: null } });
    const store = createSupabaseStore(user.client, admin.client, USER);
    await store.updateRoomSummary(message.room_id, "s", 4);
    expect(admin.calls[0]).toContain(`eq(["user_id","${USER}"])`);
    await store.incrementTokens(42);
    expect(admin.calls.at(-1)).toBe(`rpc(increment_token_usage,{"p_user_id":"${USER}","p_tokens":42})`);
  });

  it("T-SEC-34: eigener Key wird nur verschlüsselt und nur für die eigene ID gespeichert", async () => {
    const user = fakeClient({});
    const admin = fakeClient({ user_profiles: { data: { id: USER, subscription_tier: "team", custom_openrouter_key: null }, error: null } });
    const store = createSupabaseStore(user.client, admin.client, USER);
    await store.setCustomKey("sk-or-v1-abcdefghijklmnop");
    expect(admin.calls[0]).not.toContain("abcdefghijklmnop");
    expect(admin.calls[0]).toContain('"custom_openrouter_key":"v1:');
    expect(admin.calls[0]).toContain(`eq(["id","${USER}"])`);
  });
});
