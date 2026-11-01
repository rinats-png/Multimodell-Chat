import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const demoCookie = { value: "11111111-2222-4333-8444-555555555555" as string | undefined };
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (demoCookie.value ? { value: demoCookie.value } : undefined) }) }));
import { POST as choosePlan } from "@/app/api/billing/plan/route";
import { describeError } from "@/lib/log";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { Markdown } from "@/components/chat/MessageItem";
import { getSession, toPublicProfile } from "@/lib/session";
import { createMemoryStore } from "@/lib/store/memory-store";
import { jsonRequest } from "./support/fixtures";

afterEach(() => vi.unstubAllEnvs());

describe("weitere Sicherheitstests", () => {
  it("T-SEC-26: Sitzungs-Cookies HttpOnly, SameSite=Lax, 30 Tage", () => {
    expect(SESSION_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 });
  });

  it("T-SEC-27: Tarifwechsel ohne Zahlung ist in Produktion gesperrt (auch im Demo-Workspace)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEMO_MODE", "true");
    const res = await choosePlan(jsonRequest("/api/billing/plan", "POST", { tier: "team" }));
    expect(res.status).toBe(403);
  });

  it("T-SEC-32: öffentliche Demo – jeder Besucher hat einen eigenen Datenbestand, ohne Besucher-Cookie kein Zugriff", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEMO_MODE", "true");
    await createMemoryStore("11111111-2222-4333-8444-555555555555").createRoom("Besucher A");
    const a = await getSession();
    expect((await a.store.listRooms()).map((r) => r.title)).toEqual(["Besucher A"]);
    expect(a.allowPlatformKey).toBe(false);
    expect(a.userId).toBe("11111111-2222-4333-8444-555555555555");
    expect(await createMemoryStore("99999999-2222-4333-8444-555555555555").listRooms()).toEqual([]);
    demoCookie.value = undefined;
    try {
      await expect(getSession()).rejects.toThrow();
    } finally {
      demoCookie.value = "11111111-2222-4333-8444-555555555555"; // auch bei fehlgeschlagener Prüfung wiederherstellen
    }
  });

  it("T-SEC-33: Browser-Profil enthält weder Key noch Stripe-IDs", () => {
    const profile = toPublicProfile({
      id: "u", subscription_tier: "team", monthly_token_limit: 1, tokens_used_this_month: 0, usage_period_start: "2026-10-01", tokens_used_today: 0, usage_day: "2026-10-01",
      rate_limit_per_min: 60, custom_openrouter_key: "sk-or-v1-abcdefghijklmnop", provider_keys: {}, created_at: "x",
      ...({ stripe_customer_id: "cus_geheim", stripe_subscription_id: "sub_geheim" } as object),
    });
    expect(JSON.stringify(profile)).not.toMatch(/cus_geheim|sub_geheim|abcdefghijklmnop/);
  });

  it("T-SEC-28: Markdown aus KI-Antworten lädt keine externen Bilder und kein HTML", () => {
    const html = renderToStaticMarkup(createElement(Markdown, null, "![x](https://evil.example/track.png) <script>alert(1)</script>"));
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });

  it("T-SEC-29: Fehlerprotokoll enthält keine Request-Bodies (Chat-Inhalte)", () => {
    const error = Object.assign(new Error("Bad Request"), { statusCode: 400, requestBodyValues: { messages: ["GEHEIMER INHALT"] } });
    expect(JSON.stringify(describeError(error))).not.toContain("GEHEIMER INHALT");
  });
});
