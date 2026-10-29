import { encryptSecret, decryptSecret } from "../crypto";
import { DEFAULT_AGENTS } from "../default-agents";
import { PLANS } from "../plans";
import type { ChatMessage, ChatRoom, RoomAgent, UserProfile } from "../types";
import type { DataStore } from "./types";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

interface MemoryDb {
  profile: UserProfile;
  rooms: Map<string, ChatRoom>;
  agents: Map<string, RoomAgent>;
  messages: Map<string, ChatMessage>;
}

const globalForDb = globalThis as unknown as { __mmchatMemoryDb?: MemoryDb };

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function freshDb(): MemoryDb {
  return {
    profile: {
      id: DEMO_USER_ID,
      subscription_tier: "free",
      monthly_token_limit: PLANS.free.monthlyTokenLimit,
      tokens_used_this_month: 0,
      usage_period_start: monthStart(),
      rate_limit_per_min: PLANS.free.rateLimitPerMin,
      custom_openrouter_key: null,
      created_at: new Date().toISOString(),
    },
    rooms: new Map(),
    agents: new Map(),
    messages: new Map(),
  };
}

function db(): MemoryDb {
  globalForDb.__mmchatMemoryDb ??= freshDb();
  return globalForDb.__mmchatMemoryDb;
}

/** Nur für Tests und „Konto löschen“ im Demo-Workspace. */
export function resetMemoryDb(): void {
  globalForDb.__mmchatMemoryDb = freshDb();
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} nicht gefunden`);
  return value;
}

function decryptedProfile(p: UserProfile): UserProfile {
  return { ...p, custom_openrouter_key: decryptSecret(p.custom_openrouter_key) };
}

/** In-Memory-Store für den lokalen Demo-Betrieb ohne Supabase (ein Demo-Nutzer). */
export const memoryStore: DataStore = {
  async getProfile() {
    const p = db().profile;
    if (p.usage_period_start < monthStart()) {
      p.tokens_used_this_month = 0;
      p.usage_period_start = monthStart();
    }
    return decryptedProfile(p);
  },
  async setCustomKey(key) {
    db().profile.custom_openrouter_key = key ? encryptSecret(key) : null;
    return decryptedProfile(db().profile);
  },
  async setTier(tier) {
    const p = db().profile;
    p.subscription_tier = tier;
    p.monthly_token_limit = PLANS[tier].monthlyTokenLimit;
    p.rate_limit_per_min = PLANS[tier].rateLimitPerMin;
    if (!PLANS[tier].byok) p.custom_openrouter_key = null;
    return decryptedProfile(p);
  },
  async incrementTokens(tokens) {
    db().profile.tokens_used_this_month += Math.max(0, Math.round(tokens));
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
      user_id: DEMO_USER_ID,
      title: title ?? "Neue KI-Debatte",
      orchestration_mode: "router",
      sliding_window_size: 12,
      max_auto_turns: 3,
      running_summary: "",
      summarized_message_count: 0,
      created_at: new Date().toISOString(),
    };
    db().rooms.set(room.id, room);
    for (const agent of DEFAULT_AGENTS) {
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
    const created: ChatMessage = { ...message, id: crypto.randomUUID(), created_at: ts };
    db().messages.set(created.id, created);
    return { ...created };
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
  async exportAccount() {
    const { custom_openrouter_key, ...profile } = db().profile;
    const rooms = await this.listRooms();
    return {
      exported_at: new Date().toISOString(),
      profile: { ...profile, has_custom_key: Boolean(custom_openrouter_key) },
      rooms: await Promise.all(
        rooms.map(async (room) => ({ ...room, agents: await this.listAgents(room.id), messages: await this.listMessages(room.id) })),
      ),
    };
  },
  async deleteAccount() {
    resetMemoryDb();
  },
};
