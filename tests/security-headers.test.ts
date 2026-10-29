import { describe, expect, it } from "vitest";
import { buildCsp, isAllowedOrigin, STATIC_SECURITY_HEADERS } from "@/lib/security-headers";

describe("Security-Header (T-SEC-11)", () => {
  it("CSP mit Nonce, ohne unsafe-eval in Produktion, frame-ancestors none", () => {
    const csp = buildCsp("abc", { dev: false, supabaseUrl: "https://x.supabase.co" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self' https://x.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob:");
  });

  it("statische Header vorhanden", () => {
    expect(STATIC_SECURITY_HEADERS["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(STATIC_SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(STATIC_SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});

describe("CSRF / Origin-Prüfung (T-SEC-12)", () => {
  const own = "https://app.example";
  it("erlaubt GET und eigene Origin", () => {
    expect(isAllowedOrigin("GET", "/api/rooms", "https://evil.example", own, null)).toBe(true);
    expect(isAllowedOrigin("POST", "/api/rooms", own, own, null)).toBe(true);
  });
  it("blockiert fremde Origin und fehlende Herkunft bei schreibenden Anfragen", () => {
    expect(isAllowedOrigin("POST", "/api/rooms", "https://evil.example", own, null)).toBe(false);
    expect(isAllowedOrigin("DELETE", "/api/account", null, own, "cross-site")).toBe(false);
    expect(isAllowedOrigin("PATCH", "/api/profile", null, own, null)).toBe(false);
  });
  it("Stripe-Webhook ist ausgenommen (eigene Signaturprüfung)", () => {
    expect(isAllowedOrigin("POST", "/api/billing/webhook", null, own, null)).toBe(true);
  });
});
