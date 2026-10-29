/**
 * Security-Header (Regel 6.2, BF-07). Werte aus docs/idea-to-app/14-sicherheit.md.
 * CSP mit Nonce pro Anfrage; Next.js versieht seine Inline-Skripte automatisch mit der Nonce.
 */

export function buildCsp(nonce: string, options: { dev: boolean; supabaseUrl?: string }): string {
  const connect = ["'self'"];
  if (options.supabaseUrl) connect.push(options.supabaseUrl);
  const script = [`'self'`, `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (options.dev) script.push("'unsafe-eval'"); // nur React Refresh im Entwicklungsmodus
  return [
    "default-src 'self'",
    `script-src ${script.join(" ")}`,
    // Inline-Styles: von React-Style-Attributen (Fortschrittsbalken) benötigt – begründete Ausnahme E-007.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "X-Frame-Options": "DENY",
};

/**
 * CSRF-Schutz für Cookie-Sitzungen (Regel 5.4): Schreibende API-Anfragen müssen vom
 * eigenen Origin kommen. Ausnahme: Stripe-Webhook (eigene Signaturprüfung).
 */
export function isAllowedOrigin(method: string, path: string, origin: string | null, ownOrigin: string, fetchSite: string | null): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
  if (path === "/api/billing/webhook") return true;
  if (origin) return origin === ownOrigin;
  // Ohne Origin-Header nur, wenn der Browser die Anfrage ausdrücklich als same-origin kennzeichnet.
  return fetchSite === "same-origin";
}
