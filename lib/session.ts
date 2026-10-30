import "server-only";
import { isLocalSubscriptionMode } from "./ai/local-cli";
import { effectiveCustomKey, effectiveProviderKey, hasUniversalOwnAccess } from "./ai/provider";
import { sessionAuthTime } from "./auth-time";
import { assertProductionConfig, demoMayUsePlatformKey, isDemoWorkspaceAllowed } from "./env";
import { cookies } from "next/headers";
import { isProduction } from "./env";
import { createMemoryStore, DEMO_USER_ID, memoryStore, userIdFor } from "./store/memory-store";
import { createSupabaseStore } from "./store/supabase-store";
import type { DataStore } from "./store/types";
import { getSupabaseAdmin } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";
import { PROVIDER_KEY_IDS, type ConnectionInfo, type PublicProfile, type UserProfile } from "./types";

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

export const DEMO_VISITOR_COOKIE = "mmchat_demo";

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
    // Öffentliche Demo (Produktion): eigener Bestand je Besucher-Cookie, gesetzt von der Middleware.
    const visitor = isProduction() ? (await cookies()).get(DEMO_VISITOR_COOKIE)?.value : undefined;
    if (isProduction() && !visitor) throw new UnauthorizedError();
    return {
      userId: visitor ? userIdFor(visitor) : DEMO_USER_ID,
      email: "demo@multimodell.chat",
      lastSignInAt: new Date().toISOString(),
      store: visitor ? createMemoryStore(visitor) : memoryStore,
      isDemoStore: true,
      allowPlatformKey: demoMayUsePlatformKey(),
    };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    userId: user.id,
    email: user.email ?? null,
    lastSignInAt: sessionAuthTime(session?.access_token),
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

/** Allowlist der Profilfelder für den Browser – nie Key oder Stripe-IDs (Z14-06). */
const hintOf = (key: string) => `${key.slice(0, 6)}…${key.slice(-4)}`;

export function toPublicProfile(profile: UserProfile): PublicProfile {
  const key = effectiveCustomKey(profile);
  const connections: ConnectionInfo[] = [];
  if (key) connections.push({ id: "openrouter", hint: hintOf(key) });
  for (const id of PROVIDER_KEY_IDS) {
    const value = effectiveProviderKey(profile, id);
    if (value) connections.push({ id, hint: hintOf(value) });
  }
  return {
    id: profile.id,
    subscription_tier: profile.subscription_tier,
    monthly_token_limit: profile.monthly_token_limit,
    tokens_used_this_month: profile.tokens_used_this_month,
    usage_period_start: profile.usage_period_start,
    rate_limit_per_min: profile.rate_limit_per_min,
    created_at: profile.created_at,
    // Lokaler Abo-Modus zählt als eigener Zugang (die Abo-Agenten buchen kein Kontingent).
    has_custom_key: hasUniversalOwnAccess(profile) || isLocalSubscriptionMode(),
    custom_key_hint: key ? `${key.slice(0, 7)}…${key.slice(-4)}` : null,
    connections,
  };
}
