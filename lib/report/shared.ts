import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { logError } from "../log";
import { findSharedReportInMemory } from "../store/memory-store";
import { getSupabaseAdmin } from "../supabase/admin";
import { isSupabaseConfigured } from "../supabase/config";
import { reportSchema, type PublicReport } from "./schema";

/** Freigabe-Token: 24 zufällige Bytes (192 Bit), base64url, 32 Zeichen. Nur sein Hash wird gespeichert. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Öffentliche Ansicht eines freigegebenen Berichts. Gibt nur Titel, Bericht und Datum zurück, nie Raum, Konto oder
 * Nachrichten. Ungültige oder widerrufene Token liefern null (→ 404, ohne Unterschied).
 */
export async function getPublicReport(token: string): Promise<PublicReport | null> {
  if (!SHARE_TOKEN_PATTERN.test(token)) return null;
  const hash = hashShareToken(token);
  if (!isSupabaseConfigured()) return findSharedReportInMemory(hash);
  const { data, error } = await getSupabaseAdmin()
    .from("decision_reports")
    .select("title, report, created_at")
    .eq("share_token_hash", hash)
    .maybeSingle<{ title: string; report: unknown; created_at: string }>();
  if (error) {
    logError("report.public", error);
    return null;
  }
  if (!data) return null;
  const parsed = reportSchema.safeParse(data.report);
  return parsed.success ? { title: data.title, report: parsed.data, created_at: data.created_at } : null;
}
