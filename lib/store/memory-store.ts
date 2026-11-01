import { isLocalSubscriptionMode } from "../ai/local-cli";
import { decryptProviderKeys, decryptSecret, encryptProviderKeys, encryptSecret } from "../crypto";
import { defaultAgents } from "../default-agents";
import { PLANS } from "../plans";
import type { PlatformSpend } from "../platform-budget";
import { summaryOf, type StoredReport } from "../report/schema";
import type { ChatMessage, ChatRoom, RoomAgent, UserProfile } from "../types";
import type { DataStore } from "./types";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

/** Gespeichert wie in der Datenbank: Keys nur verschlüsselt. */
type StoredProfile = Omit<UserProfile, "provider_keys"> & { provider_keys: string | null };

interface MemoryDb {
  profile: StoredProfile;
  rooms: Map<string, ChatRoom>;
  agents: Map<string, RoomAgent>;
  messages: Map<string, ChatMessage>;
  reports: Map<string, MemoryReport>;
}

/** Bericht im Speicher: der Freigabe-Hash steht nur hier, nie im Rückgabewert an den Browser. */
interface MemoryReport extends StoredReport {
  token_hash: string | null;
}

/** Ein Datenbestand pro Demo-Besucher (Z14-10); lokal ein gemeinsamer Bestand „local“. */
const globalForDb = globalThis as unknown as { __mmchatMemoryDbs?: Map<string, MemoryDb> };
const MAX_DEMO_VISITORS = 500;

/** Gemeinsamer Plattform-Verbrauch (alle Demo-Besucher) im laufenden Monat; nur für Demo und Tests. */
const globalForSpend = globalThis as unknown as { __mmchatPlatformSpend?: { month: string; spend: PlatformSpend } };

function platformSpendNow(): PlatformSpend {
  const month = monthStart();
  if (!globalForSpend.__mmchatPlatformSpend || globalForSpend.__mmchatPlatformSpend.month !== month) {
    globalForSpend.__mmchatPlatformSpend = { month, spend: { trial_usd: 0, paid_usd: 0 } };
  }
  return globalForSpend.__mmchatPlatformSpend.spend;
}

/** Nur für Tests: gemeinsamen Plattform-Verbrauch zurücksetzen. */
export function resetPlatformSpend(): void {
  globalForSpend.__mmchatPlatformSpend = undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function freshDb(userId: string): MemoryDb {
  // Lokaler Abo-Modus: Einzelplatz ohne Tarifgrenzen bei Agenten und Runden.
  const tier = isLocalSubscriptionMode() ? "team" : "free";
  return {
    profile: {
      id: userId,
      subscription_tier: tier,
      monthly_token_limit: PLANS[tier].monthlyTokenLimit,
      tokens_used_this_month: 0,
      usage_period_start: monthStart(),
      tokens_used_today: 0,
      usage_day: today(),
      rate_limit_per_min: PLANS[tier].rateLimitPerMin,
      custom_openrouter_key: null,
      provider_keys: null,
      created_at: new Date().toISOString(),
    },
    rooms: new Map(),
    agents: new Map(),
    messages: new Map(),
    reports: new Map(),
  };
}

/** Jeder Demo-Besucher ist ein eigener Nutzer (eigene Limits); lokal der feste Demo-Nutzer. */
export function userIdFor(visitorId: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(visitorId) ? visitorId : DEMO_USER_ID;
}

function dbs(): Map<string, MemoryDb> {
  globalForDb.__mmchatMemoryDbs ??= new Map();
  return globalForDb.__mmchatMemoryDbs;
}

function dbFor(visitorId: string): MemoryDb {
  const all = dbs();
  let found = all.get(visitorId);
  if (!found) {
    // Älteste Besucher verwerfen, damit der Speicher begrenzt bleibt.
    while (all.size >= MAX_DEMO_VISITORS) all.delete(all.keys().next().value!);
    found = freshDb(userIdFor(visitorId));
    all.set(visitorId, found);
  }
  return found;
}

function publicStored(r: MemoryReport): StoredReport {
  const { token_hash: _hash, ...rest } = r;
  return { ...rest, report: structuredClone(r.report) };
}

/** Öffentliche Ansicht (Demo): sucht den Bericht über den Hash des Freigabe-Tokens in allen Beständen. */
export function findSharedReportInMemory(tokenHash: string): { title: string; report: StoredReport["report"]; created_at: string } | null {
  for (const d of dbs().values()) {
    for (const r of d.reports.values()) {
      if (r.token_hash && r.token_hash === tokenHash) return { title: r.title, report: structuredClone(r.report), created_at: r.created_at };
    }
  }
  return null;
}

/** Nur für Tests: alle Demo-Bestände verwerfen. */
export function resetMemoryDb(): void {
  dbs().clear();
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} nicht gefunden`);
  return value;
}

function decryptedProfile(p: StoredProfile): UserProfile {
  return { ...p, custom_openrouter_key: decryptSecret(p.custom_openrouter_key), provider_keys: decryptProviderKeys(p.provider_keys) };
}

/** In-Memory-Store für den Demo-Betrieb ohne Supabase – je Besucher ein eigener Bestand. */
export function createMemoryStore(visitorId: string): DataStore {
  const db = () => dbFor(visitorId);
  const store: DataStore = {
  async getProfile() {
    const p = db().profile;
    // Wie in der Datenbank: der Starter hat einen einmaligen Testlauf ohne Monatsumbruch.
    if (!PLANS[p.subscription_tier].trialOnly && p.usage_period_start < monthStart()) {
      p.tokens_used_this_month = 0;
      p.usage_period_start = monthStart();
    }
    return decryptedProfile(p);
  },
  async setCustomKey(key) {
    db().profile.custom_openrouter_key = key ? encryptSecret(key) : null;
    return decryptedProfile(db().profile);
  },
  async setProviderKey(id, key) {
    const p = db().profile;
    p.provider_keys = encryptProviderKeys({ ...decryptProviderKeys(p.provider_keys), [id]: key ?? undefined });
    return decryptedProfile(p);
  },
  async setTier(tier) {
    const p = db().profile;
    // Wechsel vom Starter zu einem bezahlten Tarif: der Testlauf wird nicht angerechnet.
    if (PLANS[p.subscription_tier].trialOnly && !PLANS[tier].trialOnly) {
      p.tokens_used_this_month = 0;
      p.usage_period_start = monthStart();
    }
    p.subscription_tier = tier;
    p.monthly_token_limit = PLANS[tier].monthlyTokenLimit;
    p.rate_limit_per_min = PLANS[tier].rateLimitPerMin;
    if (!PLANS[tier].byok) {
      p.custom_openrouter_key = null;
      p.provider_keys = null;
    }
    return decryptedProfile(p);
  },
  async incrementTokens(tokens) {
    const p = db().profile;
    const n = Math.max(0, Math.round(tokens));
    p.tokens_used_this_month += n;
    p.tokens_used_today = p.usage_day === today() ? p.tokens_used_today + n : n;
    p.usage_day = today();
  },
  async getPlatformSpend() {
    return { ...platformSpendNow() };
  },
  async addPlatformSpend(costUsd, trial) {
    const spend = platformSpendNow();
    const cost = Math.max(0, costUsd);
    if (trial) spend.trial_usd += cost;
    else spend.paid_usd += cost;
  },

  async listRooms() {
    return [...db().rooms.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({ ...r }));
  },
  async getRoom(roomId) {
    const room = db().rooms.get(roomId);
    return room ? { ...room } : null;
  },
  async createRoom(title) {
    const room: ChatRoom = {
      id: crypto.randomUUID(),
      user_id: userIdFor(visitorId),
      title: title ?? "Neue KI-Debatte",
      orchestration_mode: "router",
      sliding_window_size: 12,
      max_auto_turns: 3,
      running_summary: "",
      summarized_message_count: 0,
      created_at: new Date().toISOString(),
    };
    db().rooms.set(room.id, room);
    for (const agent of defaultAgents()) {
      const id = crypto.randomUUID();
      db().agents.set(id, { ...agent, id, room_id: room.id });
    }
    return { ...room };
  },
  async updateRoom(roomId, patch) {
    const room = must(db().rooms.get(roomId), "Raum");
    Object.assign(room, patch);
    return { ...room };
  },
  async updateRoomSummary(roomId, summary, summarizedCount) {
    const room = must(db().rooms.get(roomId), "Raum");
    room.running_summary = summary;
    room.summarized_message_count = summarizedCount;
  },
  async deleteRoom(roomId) {
    const d = db();
    d.rooms.delete(roomId);
    for (const [id, a] of d.agents) if (a.room_id === roomId) d.agents.delete(id);
    for (const [id, m] of d.messages) if (m.room_id === roomId) d.messages.delete(id);
    for (const [id, r] of d.reports) if (r.room_id === roomId) d.reports.delete(id);
  },

  async listAgents(roomId) {
    return [...db().agents.values()]
      .filter((a) => a.room_id === roomId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((a) => ({ ...a }));
  },
  async getAgent(agentId) {
    const agent = db().agents.get(agentId);
    return agent ? { ...agent } : null;
  },
  async createAgent(agent) {
    const created: RoomAgent = { ...agent, id: crypto.randomUUID() };
    db().agents.set(created.id, created);
    return { ...created };
  },
  async updateAgent(agentId, patch) {
    const agent = db().agents.get(agentId);
    if (!agent) return null;
    Object.assign(agent, patch);
    return { ...agent };
  },
  async deleteAgent(agentId) {
    if (!db().agents.delete(agentId)) return false;
    for (const m of db().messages.values()) if (m.agent_id === agentId) m.agent_id = null;
    return true;
  },

  async listMessages(roomId) {
    return [...db().messages.values()]
      .filter((m) => m.room_id === roomId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({ ...m }));
  },
  async insertMessage(message) {
    must(db().rooms.get(message.room_id), "Raum");
    // Monoton steigende Zeitstempel, damit die Sortierung stabil bleibt.
    const lastTs = [...db().messages.values()].reduce((max, m) => (m.created_at > max ? m.created_at : max), "");
    let ts = new Date().toISOString();
    if (ts <= lastTs) ts = new Date(new Date(lastTs).getTime() + 1).toISOString();
    const created: ChatMessage = { ...message, stance: null, stance_target_id: null, id: crypto.randomUUID(), created_at: ts };
    db().messages.set(created.id, created);
    return { ...created };
  },
  async setMessageStance(messageId, stance, targetId) {
    const m = must(db().messages.get(messageId), "Nachricht");
    m.stance = stance;
    m.stance_target_id = targetId;
  },
  async clearMessages(roomId) {
    const d = db();
    for (const [id, m] of d.messages) if (m.room_id === roomId) d.messages.delete(id);
    const room = d.rooms.get(roomId);
    if (room) {
      room.running_summary = "";
      room.summarized_message_count = 0;
    }
  },

  async getUsageTotals() {
    return [...db().messages.values()].reduce(
      (acc, m) => ({
        input: acc.input + m.input_tokens,
        output: acc.output + m.output_tokens,
        cost: acc.cost + m.estimated_cost_usd,
        replies: acc.replies + (m.sender_type === "agent" ? 1 : 0),
      }),
      { input: 0, output: 0, cost: 0, replies: 0 },
    );
  },
  async createReport(input) {
    if (!db().rooms.has(input.room_id)) throw new Error("Raum nicht gefunden");
    if (db().reports.size >= 500) throw new Error("Höchstens 500 Berichte pro Konto");
    const stored: MemoryReport = {
      id: crypto.randomUUID(),
      room_id: input.room_id,
      title: input.title,
      report: input.report,
      shared: false,
      shared_at: null,
      created_at: new Date().toISOString(),
      token_hash: null,
    };
    db().reports.set(stored.id, stored);
    return publicStored(stored);
  },
  async listReports() {
    return [...db().reports.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => summaryOf(r));
  },
  async getReport(reportId) {
    const r = db().reports.get(reportId);
    return r ? publicStored(r) : null;
  },
  async deleteReport(reportId) {
    return db().reports.delete(reportId);
  },
  async setReportShare(reportId, tokenHash) {
    const r = db().reports.get(reportId);
    if (!r) return false;
    r.token_hash = tokenHash;
    r.shared = tokenHash !== null;
    r.shared_at = tokenHash ? new Date().toISOString() : null;
    return true;
  },

  async exportAccount() {
    const { custom_openrouter_key, provider_keys, ...profile } = db().profile;
    const rooms = await store.listRooms();
    return {
      exported_at: new Date().toISOString(),
      profile: { ...profile, has_custom_key: Boolean(custom_openrouter_key || provider_keys) },
      rooms: await Promise.all(
        rooms.map(async (room) => ({ ...room, agents: await store.listAgents(room.id), messages: await store.listMessages(room.id) })),
      ),
      reports: [...db().reports.values()].map(publicStored),
    };
  },
  async deleteAccount() {
    dbs().set(visitorId, freshDb(userIdFor(visitorId)));
  },
  };
  return store;
}

/** Lokaler Entwicklungs-Workspace (ein gemeinsamer Bestand). */
export const memoryStore = createMemoryStore("local");
