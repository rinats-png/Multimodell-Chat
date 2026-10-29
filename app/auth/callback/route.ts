import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Nur diese Ziele sind nach dem Callback erlaubt (keine offene Weiterleitung, Regel 5.7). */
const ALLOWED_NEXT = new Set(["/chat", "/passwort-neu"]);

/** Bestätigungs- und Reset-Links: Code gegen Session tauschen. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/chat";
  const next = ALLOWED_NEXT.has(nextParam) ? nextParam : "/chat";
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?link=ungueltig", url.origin));
}
