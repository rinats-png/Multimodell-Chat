import { NextResponse } from "next/server";
import { limitMutations } from "@/lib/api";
import { isEncryptionConfigured } from "@/lib/crypto";
import { appOrigin, authorizeUrl, createPkce, PKCE_COOKIE, PKCE_MAX_AGE_SECONDS } from "@/lib/openrouter-oauth";
import { getSession } from "@/lib/session";

/** Start von „Mit OpenRouter verbinden“: PKCE-Werte erzeugen und zu OpenRouter weiterleiten. */
export async function GET(request: Request) {
  const origin = appOrigin(request);
  let userId: string;
  try {
    ({ userId } = await getSession());
    await limitMutations(userId);
  } catch {
    return NextResponse.redirect(`${origin}/login`, 303);
  }
  if (!isEncryptionConfigured()) return NextResponse.redirect(`${origin}/billing?verbindung=fehler`, 303);

  const pkce = createPkce();
  const callback = `${origin}/api/connect/openrouter/callback?state=${pkce.state}`;
  const response = NextResponse.redirect(authorizeUrl(callback, pkce.challenge), 303);
  response.cookies.set(PKCE_COOKIE, pkce.cookieValue, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/connect/openrouter",
    maxAge: PKCE_MAX_AGE_SECONDS,
  });
  return response;
}
