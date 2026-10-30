import { afterEach, describe, expect, it } from "vitest";
import { effectiveCustomKey, resolveApiKey, resolveModelAccess } from "@/lib/ai/provider";
import { acquireLock, peekLimit, rateLimit, releaseLock } from "@/lib/rate-limit";
import type { UserProfile } from "@/lib/types";
import { assertCanCallModel, checkTokenQuota, UsageGuardError } from "@/lib/usage-guard";

const profile = (patch: Partial<UserProfile> = {}): UserProfile => ({
  id: "00000000-0000-4000-8000-0000000000aa",
  subscription_tier: "free",
  monthly_token_limit: 15_000,
  tokens_used_this_month: 0,
  usage_period_start: "2026-10-01",
  rate_limit_per_min: 5,
  custom_openrouter_key: null,
  provider_keys: {},
  created_at: "2026-10-01T00:00:00Z",
  ...patch,
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

describe("Kontingent (F-07)", () => {
  it("TEST-F07-1: Restkontingent muss die Schätzung des Aufrufs abdecken (T-SEC-05)", () => {
    expect(checkTokenQuota(profile({ tokens_used_this_month: 14_000 }), 900).allowed).toBe(true);
    expect(checkTokenQuota(profile({ tokens_used_this_month: 14_500 }), 900).allowed).toBe(false);
  });

  it("T-SEC-04: BYOK aus Leerzeichen hebt das Kontingent NICHT auf und bezahlt nicht mit dem Plattform-Key", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    const p = profile({ subscription_tier: "team", custom_openrouter_key: "   ", tokens_used_this_month: 2_500_000, monthly_token_limit: 2_500_000 });
    expect(effectiveCustomKey(p)).toBeNull();
    expect(checkTokenQuota(p, 100).allowed).toBe(false);
    expect(resolveApiKey(p, { allowPlatformKey: true }).source).toBe("platform");
  });

  it("T-SEC-04: eigener OpenRouter-Key zählt in jedem Tarif und hebt das Kontingent auf", () => {
    const p = profile({ custom_openrouter_key: "sk-or-v1-abcdefghijklmnop", tokens_used_this_month: 15_000 });
    expect(effectiveCustomKey(p)).toBe("sk-or-v1-abcdefghijklmnop");
    expect(checkTokenQuota(p, 100).allowed).toBe(true);
  });

  it("T-SEC-04: ein Anbieter-Key hebt das Kontingent nur für Modelle dieses Anbieters auf", () => {
    const p = profile({ provider_keys: { anthropic: "sk-ant-abcdefghijklmnopqrstuvwxyz" }, tokens_used_this_month: 15_000 });
    expect(checkTokenQuota(p, 100).allowed).toBe(false);
    expect(resolveModelAccess(p, "anthropic/claude-sonnet-4.5", { allowPlatformKey: true }).source).toBe("anthropic");
    expect(resolveModelAccess(p, "openai/gpt-5", { allowPlatformKey: false }).source).toBe("demo");
  });

  it("T-SEC-01: Demo-Workspace ohne Freigabe nutzt nie den Plattform-Key", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-platform-key-1234567890";
    expect(resolveApiKey(profile(), { allowPlatformKey: false }).source).toBe("demo");
  });
});

describe("Rate-Limit (F-08)", () => {
  it("TEST-F08-1: Minutenlimit pro Konto, danach 429 mit Wartezeit (T-SEC-06)", async () => {
    const p = profile({ rate_limit_per_min: 2 });
    await assertCanCallModel(p, 10);
    await assertCanCallModel(p, 10);
    const error = await assertCanCallModel(p, 10).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UsageGuardError);
    expect((error as UsageGuardError).status).toBe(429);
    expect((error as UsageGuardError).retryAfterMs).toBeGreaterThan(0);
  });

  it("peekLimit verbraucht keinen Versuch", async () => {
    expect((await peekLimit("b", "id", 1)).allowed).toBe(true);
    expect((await peekLimit("b", "id", 1)).allowed).toBe(true);
    await rateLimit("b", "id", 1);
    expect((await peekLimit("b", "id", 1)).allowed).toBe(false);
  });

  it("T-SEC-07: nur eine laufende Runde pro Konto", async () => {
    const token = await acquireLock("round:u1", 10);
    expect(token).toBeTruthy();
    expect(await acquireLock("round:u1", 10)).toBeNull();
    await releaseLock("round:u1", "fremdes-token");
    expect(await acquireLock("round:u1", 10)).toBeNull();
    await releaseLock("round:u1", token!);
    expect(await acquireLock("round:u1", 10)).toBeTruthy();
  });
});

describe("Client-IP (Z14-07)", () => {
  it("nimmt auf Vercel den ersten Eintrag, hinter anhängenden Proxys den vom eigenen Proxy gesetzten", async () => {
    const { clientIpFromHeaders } = await import("@/lib/rate-limit");
    const h = new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" });
    expect(clientIpFromHeaders(h)).toBe("6.6.6.6");
    process.env.TRUSTED_PROXY_HOPS = "1";
    try {
      expect(clientIpFromHeaders(h)).toBe("1.2.3.4");
    } finally {
      delete process.env.TRUSTED_PROXY_HOPS;
    }
  });
});
