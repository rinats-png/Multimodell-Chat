import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as choosePlan } from "@/app/api/billing/plan/route";
import { describeError } from "@/lib/log";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { Markdown } from "@/components/chat/MessageItem";
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
