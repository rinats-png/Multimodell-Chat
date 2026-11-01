import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Service-Role-Client: umgeht RLS. Nur serverseitig und nur für Schreibvorgänge,
 * deren Berechtigung vorher mit der Nutzer-Sitzung geprüft wurde (Ledger, Verbrauch,
 * Profil, Konto löschen). Der Schlüssel hat bewusst KEIN NEXT_PUBLIC_-Präfix.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");
  adminClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
