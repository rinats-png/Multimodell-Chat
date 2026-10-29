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

function db(): MemoryDb {
  if (!globalForDb.__mmchatMemoryDb) {
    globalForDb.__mmchatMemoryDb = {
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
  return globalForDb.__mmchatMemoryDb;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} nicht gefunden`);
  return value;
}

/** In-Memory-Store für den lokalen Demo-Betrieb ohne Supabase. */
export const memoryStore: DataStore = {
  async getProfile() {
    const p = db().profile;
    if (p.usage_period_start < monthStart()) {
      p.tokens_used_this_month = 0;
      p.usage_period_start = monthStart();
    }
    return { ...p };
  },
  async setCustomKey(key) {
    db().profile.custom_openrouter_key = key;
    return { ...db().profile };
  },
  async setTier(tier) {
    const p = db().profile;
    p.subscription_tier = tier;
    p.monthly_token_limit = PLANS[tier].monthlyTokenLimit;
    p.rate_limit_per_min = PLANS[tier].rateLimitPerMin;
    if (!PLANS[tier].byok) p.custom_openrouter_key = null;
    return { ...p };
  },
  async incrementTokens(tokens) {
    db().profile.tokens_used_this_month += Math.max(0, Math.round(tokens));
  },

  async listRooms() {
    return [...db().rooms.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
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
    return [...db().agents.values()].filter((a) => a.room_id === roomId).sort((a, b) => a.sort_order - b.sort_order);
  },
  async createAgent(agent) {
    const created: RoomAgent = { ...agent, id: crypto.randomUUID() };
    db().agents.set(created.id, created);
    return { ...created };
  },
  async updateAgent(agentId, patch) {
    const agent = must(db().agents.get(agentId), "Agent");
    Object.assign(agent, patch);
    return { ...agent };
  },
  async deleteAgent(agentId) {
    db().agents.delete(agentId);
    for (const m of db().messages.values()) if (m.agent_id === agentId) m.agent_id = null;
  },

  async listMessages(roomId) {
    return [...db().messages.values()]
      .filter((m) => m.room_id === roomId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async insertMessage(message) {
    // Monoton steigende Zeitstempel, damit die Sortierung stabil bleibt.
    const all = [...db().messages.values()];
    const lastTs = all.reduce((max, m) => (m.created_at > max ? m.created_at : max), "");
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
};
