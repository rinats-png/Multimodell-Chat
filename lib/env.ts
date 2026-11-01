import { isSupabaseConfigured } from "./supabase/config";

/**
 * Zentrale Konfigurationsprüfung. Grundsatz: In Produktion "fail closed" –
 * fehlt eine sicherheitsrelevante Variable, startet die App keine Sitzung (BF-01).
 */

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Demo-Workspace (ohne Login, In-Memory) – lokal immer, in Produktion nur ausdrücklich. */
export function isDemoWorkspaceAllowed(): boolean {
  return !isProduction() || process.env.ALLOW_DEMO_MODE === "true";
}

/**
 * Darf der Demo-Workspace den Plattform-Key (echte Modelle, echte Kosten) nutzen?
 * Nur lokal in der Entwicklung – öffentlich erreichbare Demo-Instanzen bekommen
 * ausschließlich das simulierte Modell.
 */
export function demoMayUsePlatformKey(): boolean {
  return !isProduction();
}

export function hasSharedRateLimitStore(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export class ConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Konfiguration unvollständig: ${missing.join(", ")}`);
  }
}

/** Liste fehlender Pflichtvariablen für den Produktivbetrieb mit Supabase. */
export function missingProductionConfig(): string[] {
  if (!isProduction()) return [];
  if (!isSupabaseConfigured()) {
    return process.env.ALLOW_DEMO_MODE === "true" ? [] : ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  }
  const required: [string, boolean][] = [
    ["SUPABASE_SERVICE_ROLE_KEY", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["APP_ORIGIN (https://…)", /^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN ?? "")],
    ["UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN", hasSharedRateLimitStore()],
    ["OPERATOR_NAME", Boolean(process.env.OPERATOR_NAME)],
    ["OPERATOR_ADDRESS", Boolean(process.env.OPERATOR_ADDRESS)],
    ["OPERATOR_EMAIL", Boolean(process.env.OPERATOR_EMAIL)],
  ];
  return required.filter(([, ok]) => !ok).map(([name]) => name);
}

export function assertProductionConfig(): void {
  const missing = missingProductionConfig();
  if (missing.length > 0) throw new ConfigError(missing);
}
