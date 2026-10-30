import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logError, securityLog } from "@/lib/log";
import { appOrigin, exchangeCode, PKCE_COOKIE, verifierFromCookie } from "@/lib/openrouter-oauth";
import { getSession } from "@/lib/session";

/** Rückleitung von OpenRouter: Code gegen Key tauschen und verschlüsselt speichern. */
export async function GET(request: Request) {
  const origin = appOrigin(request);
  const url = new URL(request.url);
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/billing?verbindung=fehler`, 303);
    res.cookies.set(PKCE_COOKIE, "", { path: "/api/connect/openrouter", maxAge: 0 });
    securityLog("openrouter_connect_failed", { reason });
    return res;
  };

  const verifier = verifierFromCookie((await cookies()).get(PKCE_COOKIE)?.value, url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  if (!verifier || !code || code.length > 500) return fail("state_or_code");

  try {
    const { store, userId } = await getSession();
    const key = await exchangeCode(code, verifier);
    await store.setCustomKey(key);
    securityLog("connection_set", { userId, provider: "openrouter" });
  } catch (error) {
    logError("openrouter.connect", error);
    return fail("exchange");
  }
  const res = NextResponse.redirect(`${origin}/billing?verbunden=openrouter`, 303);
  res.cookies.set(PKCE_COOKIE, "", { path: "/api/connect/openrouter", maxAge: 0 });
  return res;
}
