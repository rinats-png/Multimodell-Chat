import { afterEach, describe, expect, it, vi } from "vitest";
import { missingProductionConfig } from "@/lib/env";
import { getOperatorInfo } from "@/lib/legal";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Konfiguration fällt geschlossen aus (BF-01)", () => {
  it("T-SEC-01: Produktion ohne Supabase und ohne ausdrückliche Demo-Freigabe startet nicht", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(missingProductionConfig()).toContain("NEXT_PUBLIC_SUPABASE_URL");
    vi.stubEnv("ALLOW_DEMO_MODE", "true");
    expect(missingProductionConfig()).toEqual([]);
  });

  it("TEST-F18-1: Produktion mit Supabase verlangt Service-Key, Upstash und Betreiberangaben", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const missing = missingProductionConfig();
    expect(missing).toEqual(expect.arrayContaining(["SUPABASE_SERVICE_ROLE_KEY", "OPERATOR_NAME", "OPERATOR_ADDRESS", "OPERATOR_EMAIL"]));
    expect(missing.some((m) => m.includes("UPSTASH"))).toBe(true);
  });

  it("TEST-F18-2: Impressum zeigt konfigurierte Betreiberangaben, sonst deutlichen Hinweis", () => {
    expect(getOperatorInfo().configured).toBe(false);
    vi.stubEnv("OPERATOR_NAME", "Muster GmbH");
    vi.stubEnv("OPERATOR_ADDRESS", "Musterstr. 1, 12345 Musterstadt");
    vi.stubEnv("OPERATOR_EMAIL", "kontakt@example.com");
    expect(getOperatorInfo()).toMatchObject({ name: "Muster GmbH", configured: true });
  });
});
