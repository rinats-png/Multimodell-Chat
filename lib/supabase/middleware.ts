import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "./cookies";

/** Pfade, die ohne Anmeldung erreichbar sind. */
export const PUBLIC_PATHS = [
  "/login",
  "/registrieren",
  "/passwort-vergessen",
  "/auth/callback",
  "/impressum",
  "/datenschutz",
  "/api/auth/",
  "/api/billing/webhook",
];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || (p.endsWith("/") ? path.startsWith(p) : path.startsWith(`${p}/`)));
}

/** Aktualisiert die Supabase-Session und schützt die App-Routen. */
export async function updateSession(request: NextRequest, requestHeaders: Headers): Promise<NextResponse> {
  let res = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        requestHeaders.set("cookie", request.cookies.toString());
        res = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          res.cookies.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS, maxAge: options.maxAge === 0 ? 0 : SESSION_COOKIE_OPTIONS.maxAge });
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && !isPublicPath(path)) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht angemeldet", code: "unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}
