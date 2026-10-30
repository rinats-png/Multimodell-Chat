import { NextResponse, type NextRequest } from "next/server";
import { clientIpFromHeaders, RATE_LIMITS, rateLimit, retryAfterSeconds } from "@/lib/rate-limit";
import { buildCsp, isAllowedOrigin, STATIC_SECURITY_HEADERS } from "@/lib/security-headers";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

const DEMO_VISITOR_COOKIE = "mmchat_demo";

const MAX_BODY_BYTES = 100 * 1024;
const MAX_WEBHOOK_BYTES = 256 * 1024;

function withSecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(STATIC_SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

function ownOrigin(request: NextRequest): string {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, {
    dev: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    if (!isAllowedOrigin(request.method, path, request.headers.get("origin"), ownOrigin(request), request.headers.get("sec-fetch-site"))) {
      return withSecurityHeaders(NextResponse.json({ error: "Ungültige Herkunft der Anfrage", code: "bad_origin" }, { status: 403 }), csp);
    }
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > (path === "/api/billing/webhook" ? MAX_WEBHOOK_BYTES : MAX_BODY_BYTES)) {
      return withSecurityHeaders(NextResponse.json({ error: "Anfrage zu groß", code: "payload_too_large" }, { status: 413 }), csp);
    }
    const ip = clientIpFromHeaders(request.headers);
    const result = await rateLimit("api-ip", ip, RATE_LIMITS.apiPerIp.limit, RATE_LIMITS.apiPerIp.windowMs);
    if (!result.allowed) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Zu viele Anfragen", code: "rate_limited" }, { status: 429, headers: { "Retry-After": retryAfterSeconds(result) } }),
        csp,
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  if (isSupabaseConfigured()) return withSecurityHeaders(await updateSession(request, requestHeaders), csp);

  // Demo ohne Supabase: jeder Besucher bekommt einen eigenen, zufälligen Demo-Bestand (Z14-10).
  let visitor = request.cookies.get(DEMO_VISITOR_COOKIE)?.value;
  const isNew = !visitor || !/^[0-9a-f-]{36}$/.test(visitor);
  if (isNew) {
    visitor = crypto.randomUUID();
    request.cookies.set(DEMO_VISITOR_COOKIE, visitor);
    requestHeaders.set("cookie", request.cookies.toString());
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isNew) {
    response.cookies.set(DEMO_VISITOR_COOKIE, visitor!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
  }
  return withSecurityHeaders(response, csp);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
