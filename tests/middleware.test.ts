import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";

const req = (url: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(new URL(url, "http://localhost:3000"), { method: init.method ?? "GET", headers: { host: "localhost:3000", ...init.headers } });

describe("Middleware", () => {
  it("T-SEC-11: setzt CSP mit Nonce und Security-Header auf jeder Antwort", async () => {
    const res = await middleware(req("/chat"));
    expect(res.headers.get("content-security-policy")).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("T-SEC-12: blockiert schreibende API-Anfragen fremder Herkunft", async () => {
    const res = await middleware(req("/api/rooms", { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
    const ok = await middleware(req("/api/rooms", { method: "POST", headers: { origin: "http://localhost:3000" } }));
    expect(ok.status).toBe(200);
  });

  it("T-SEC-15: zu große Anfrage → 413", async () => {
    const res = await middleware(req("/api/rooms", { method: "POST", headers: { origin: "http://localhost:3000", "content-length": String(200 * 1024) } }));
    expect(res.status).toBe(413);
  });
});
