import "server-only";
import { DEMO_USER_ID, memoryStore } from "./store/memory-store";
import { createSupabaseStore } from "./store/supabase-store";
import type { DataStore } from "./store/types";
import { isSupabaseConfigured } from "./supabase/config";
import { createSupabaseServerClient } from "./supabase/server";
import type { PublicProfile, UserProfile } from "./types";

export interface AppSession {
  userId: string;
  email: string | null;
  store: DataStore;
  /** true, wenn ohne Supabase mit In-Memory-Daten gearbeitet wird. */
  isDemoStore: boolean;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Nicht angemeldet");
  }
}

/** Ermittelt den aktuellen User und den passenden Datenspeicher. */
export async function getSession(): Promise<AppSession> {
  if (!isSupabaseConfigured()) {
    return { userId: DEMO_USER_ID, email: "demo@multimodell.chat", store: memoryStore, isDemoStore: true };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return { userId: user.id, email: user.email ?? null, store: createSupabaseStore(supabase, user.id), isDemoStore: false };
}

export function toPublicProfile(profile: UserProfile): PublicProfile {
  const { custom_openrouter_key, ...rest } = profile;
  const key = custom_openrouter_key?.trim();
  return {
    ...rest,
    has_custom_key: Boolean(key),
    custom_key_hint: key ? `${key.slice(0, 7)}…${key.slice(-4)}` : null,
  };
}
