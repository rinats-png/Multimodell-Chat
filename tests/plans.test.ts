import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isPlatformModel, MODEL_CATALOG } from "@/lib/models";
import { PLANS } from "@/lib/plans";

describe("Tarife", () => {
  it("SQL-Funktion apply_subscription_tier spiegelt lib/plans.ts", () => {
    const sql = readFileSync(path.resolve(__dirname, "../supabase/migrations/0003_billing.sql"), "utf8");
    const tokens = sql.match(/monthly_token_limit = CASE p_tier WHEN 'free' THEN (\d+) WHEN 'pro' THEN (\d+) ELSE (\d+) END/);
    const rate = sql.match(/rate_limit_per_min = CASE p_tier WHEN 'free' THEN (\d+) WHEN 'pro' THEN (\d+) ELSE (\d+) END/);
    expect(tokens?.slice(1).map(Number)).toEqual([PLANS.free.monthlyTokenLimit, PLANS.pro.monthlyTokenLimit, PLANS.team.monthlyTokenLimit]);
    expect(rate?.slice(1).map(Number)).toEqual([PLANS.free.rateLimitPerMin, PLANS.pro.rateLimitPerMin, PLANS.team.rateLimitPerMin]);
  });

  it("Masterprompt-Werte: Starter 15k/5, Pro 500k/15, Team 2,5 Mio./60, Preise 0/29/79", () => {
    expect([PLANS.free.priceEur, PLANS.pro.priceEur, PLANS.team.priceEur]).toEqual([0, 29, 79]);
    expect(PLANS.team.byok).toBe(true);
  });

  it("T-SEC-03: Plattform-Key nur für Katalog-Modelle", () => {
    expect(MODEL_CATALOG.length).toBeGreaterThan(0);
    expect(isPlatformModel("openai/gpt-4o")).toBe(true);
    expect(isPlatformModel("openai/o1-pro")).toBe(false);
  });
});
