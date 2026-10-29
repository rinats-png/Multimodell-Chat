import "server-only";
import { effectiveCustomKey } from "./ai/provider";
import { assertProductionConfig, demoMayUsePlatformKey, isDemoWorkspaceAllowed } from "./env";
import { DEMO_USER_ID, memoryStore } from "./store/memory-store";
import { createSupabaseStore } from "./store/supabase-store";
import type { DataStore } from "./store/types";
import { getSupabaseAdmin } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";
import type { PublicProfile, UserProfile } from "./types";

export interface AppSession {
  userId: string;
  email: string | null;
  /** Zeitpunkt der letzten Anmeldung (für erneute Anmeldung vor sensiblen Aktionen). */
  lastSignInAt: string | null;
  store: DataStore;
  /** true, wenn ohne Supabase mit In-Memory-Daten gearbeitet wird. */
  isDemoStore: boolean;
  /** Darf diese Sitzung den Plattform-Key (echte Kosten) nutzen? */
  allowPlatformKey: boolean;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Nicht angemeldet");
  }
}

/** Ermittelt den aktuellen User und den passenden Datenspeicher (fail closed, BF-01). */
export async function getSession(): Promise<AppSession> {
  assertProductionConfig();
  if (!isSupabaseConfigured()) {
    if (!isDemoWorkspaceAllowed()) throw new UnauthorizedError();
    return {
      userId: DEMO_USER_ID,
      email: "demo@multimodell.chat",
      lastSignInAt: new Date().toISOString(),
      store: memoryStore,
      isDemoStore: true,
      allowPlatformKey: demoMayUsePlatformKey(),
    };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return {
    userId: user.id,
    email: user.email ?? null,
    lastSignInAt: user.last_sign_in_at ?? null,
    store: createSupabaseStore(supabase, getSupabaseAdmin(), user.id),
    isDemoStore: false,
    allowPlatformKey: true,
  };
}

/** Sensible Aktionen (Konto löschen, Export) nur mit frischer Anmeldung. */
export const REAUTH_MAX_AGE_MS = 15 * 60_000;

export function isRecentSignIn(session: Pick<AppSession, "lastSignInAt" | "isDemoStore">): boolean {
  if (session.isDemoStore) return true;
  if (!session.lastSignInAt) return false;
  return Date.now() - new Date(session.lastSignInAt).getTime() <= REAUTH_MAX_AGE_MS;
}

export function toPublicProfile(profile: UserProfile): PublicProfile {
  const { custom_openrouter_key: _key, ...rest } = profile;
  const key = effectiveCustomKey(profile);
  return {
    ...rest,
    has_custom_key: Boolean(key),
    custom_key_hint: key ? `${key.slice(0, 7)}…${key.slice(-4)}` : null,
  };
}
