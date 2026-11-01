import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
};
const tokenWithAuthTime = (secondsAgo: number) =>
  `x.${Buffer.from(JSON.stringify({ amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - secondsAgo }] })).toString("base64url")}.y`;
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));

const { POST: login } = await import("@/app/api/auth/login/route");
const { POST: signup } = await import("@/app/api/auth/signup/route");
const { POST: reset } = await import("@/app/api/auth/reset/route");
const { POST: password } = await import("@/app/api/auth/password/route");
const { jsonRequest } = await import("./support/fixtures");

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  for (const fn of Object.values(auth)) fn.mockReset();
  auth.signOut.mockResolvedValue({ error: null });
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

const strongPassword = "ein langer satz als passwort";

describe("Anmeldung (F-01)", () => {
  it("TEST-F01-1: falsches Passwort und unbekannte E-Mail ergeben dieselbe Antwort (T-SEC-23)", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const a = await login(jsonRequest("/api/auth/login", "POST", { email: "gibt-es@test.local", password: "falsch" }));
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Email not confirmed" } });
    const b = await login(jsonRequest("/api/auth/login", "POST", { email: "unbestaetigt@test.local", password: "falsch" }));
    expect(a.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
  });

  it("TEST-F01-2: erfolgreiche Anmeldung", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    const res = await login(jsonRequest("/api/auth/login", "POST", { email: "a@test.local", password: strongPassword }));
    expect(res.status).toBe(200);
  });

  it("T-SEC-24: nach 5 Fehlversuchen pro Konto vorübergehend gesperrt (429 + Retry-After), Passwort wird dann nicht mehr geprüft", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    for (let i = 0; i < 5; i++) await login(jsonRequest("/api/auth/login", "POST", { email: "opfer@test.local", password: `x${i}` }));
    auth.signInWithPassword.mockClear();
    const res = await login(jsonRequest("/api/auth/login", "POST", { email: "Opfer@Test.local", password: "richtig" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("TEST-F01-3: Registrierung antwortet gleich, auch wenn die E-Mail existiert (T-SEC-23)", async () => {
    auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    const a = await signup(jsonRequest("/api/auth/signup", "POST", { email: "neu@test.local", password: strongPassword, acceptTerms: true }));
    auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: { message: "User already registered", code: "user_already_exists" } });
    const b = await signup(jsonRequest("/api/auth/signup", "POST", { email: "alt@test.local", password: strongPassword, acceptTerms: true }));
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual(await b.json());
  });

  it("TEST-F01-4: Registrierung verlangt Mindestlänge und Zustimmung", async () => {
    const short = await signup(jsonRequest("/api/auth/signup", "POST", { email: "x@test.local", password: "kurz", acceptTerms: true }));
    expect(short.status).toBe(400);
    const noTerms = await signup(jsonRequest("/api/auth/signup", "POST", { email: "x@test.local", password: strongPassword, acceptTerms: false }));
    expect(noTerms.status).toBe(400);
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});

describe("Passwort-Reset (F-17)", () => {
  it("TEST-F17-1: gleiche Antwort für jede Adresse; ab dem 4. Versuch pro Stunde wird intern nicht mehr versendet", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const bodies = [];
    for (let i = 0; i < 4; i++) {
      const res = await reset(jsonRequest("/api/auth/reset", "POST", { email: "a@test.local" }));
      expect(res.status).toBe(200);
      bodies.push(await res.json());
    }
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(3);
    expect(auth.resetPasswordForEmail.mock.calls[0]![1].redirectTo).toContain("/auth/callback?next=/passwort-neu");
  });

  it("T-SEC-31: Passwortänderung nur mit frischer Anmeldung dieser Sitzung (Reset-Link ≤ 15 min)", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    auth.getSession.mockResolvedValue({ data: { session: { access_token: tokenWithAuthTime(3600) } } });
    const res = await password(jsonRequest("/api/auth/password", "POST", { password: strongPassword }));
    expect(res.status).toBe(403);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("TEST-F17-2: neues Passwort beendet alle anderen Sitzungen", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    auth.getSession.mockResolvedValue({ data: { session: { access_token: tokenWithAuthTime(60) } } });
    auth.updateUser.mockResolvedValue({ error: null });
    const res = await password(jsonRequest("/api/auth/password", "POST", { password: strongPassword }));
    expect(res.status).toBe(200);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
});
