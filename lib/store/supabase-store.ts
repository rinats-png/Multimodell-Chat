import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_AGENTS } from "../default-agents";
import type { ChatMessage, ChatRoom, RoomAgent, UserProfile } from "../types";
import type { DataStore } from "./types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: keine Daten`);
  return result.data;
}

function normalizeMessage(row: ChatMessage): ChatMessage {
  return { ...row, estimated_cost_usd: Number(row.estimated_cost_usd) };
}

/** Supabase-Store: alle Zugriffe laufen mit der Session des Users und unterliegen RLS. */
export function createSupabaseStore(supabase: SupabaseClient, userId: string): DataStore {
  return {
    async getProfile() {
      const rolled = await supabase.rpc("roll_usage_period");
      if (!rolled.error && rolled.data) return rolled.data as UserProfile;
      return unwrap(
        await supabase.from("user_profiles").select("*").eq("id", userId).single<UserProfile>(),
        "Profil laden",
      );
    },
    async setCustomKey(key) {
      return unwrap(
        await supabase
          .from("user_profiles")
          .update({ custom_openrouter_key: key })
          .eq("id", userId)
          .select("*")
          .single<UserProfile>(),
        "API-Key speichern",
      );
    },
    async incrementTokens(tokens) {
      const { error } = await supabase.rpc("increment_token_usage", { p_tokens: Math.max(0, Math.round(tokens)) });
      if (error) throw new Error(`Token-Verbrauch buchen: ${error.message}`);
    },

    async listRooms() {
      return unwrap(
        await supabase.from("chat_rooms").select("*").order("created_at", { ascending: false }).returns<ChatRoom[]>(),
        "Räume laden",
      );
    },
    async getRoom(roomId) {
      const { data, error } = await supabase.from("chat_rooms").select("*").eq("id", roomId).maybeSingle<ChatRoom>();
      if (error) throw new Error(`Raum laden: ${error.message}`);
      return data;
    },
    async createRoom(title) {
      const room = unwrap(
        await supabase
          .from("chat_rooms")
          .insert({ user_id: userId, ...(title ? { title } : {}) })
          .select("*")
          .single<ChatRoom>(),
        "Raum anlegen",
      );
      const { error } = await supabase.from("room_agents").insert(DEFAULT_AGENTS.map((a) => ({ ...a, room_id: room.id })));
      if (error) throw new Error(`Standard-Agenten anlegen: ${error.message}`);
      return room;
    },
    async updateRoom(roomId, patch) {
      return unwrap(
        await supabase.from("chat_rooms").update(patch).eq("id", roomId).select("*").single<ChatRoom>(),
        "Raum speichern",
      );
    },
    async updateRoomSummary(roomId, summary, summarizedCount) {
      const { error } = await supabase
        .from("chat_rooms")
        .update({ running_summary: summary, summarized_message_count: summarizedCount })
        .eq("id", roomId);
      if (error) throw new Error(`Zusammenfassung speichern: ${error.message}`);
    },
    async deleteRoom(roomId) {
      const { error } = await supabase.from("chat_rooms").delete().eq("id", roomId);
      if (error) throw new Error(`Raum löschen: ${error.message}`);
    },

    async listAgents(roomId) {
      return unwrap(
        await supabase
          .from("room_agents")
          .select("*")
          .eq("room_id", roomId)
          .order("sort_order", { ascending: true })
          .returns<RoomAgent[]>(),
        "Agenten laden",
      );
    },
    async createAgent(agent) {
      return unwrap(await supabase.from("room_agents").insert(agent).select("*").single<RoomAgent>(), "Agent anlegen");
    },
    async updateAgent(agentId, patch) {
      return unwrap(
        await supabase.from("room_agents").update(patch).eq("id", agentId).select("*").single<RoomAgent>(),
        "Agent speichern",
      );
    },
    async deleteAgent(agentId) {
      const { error } = await supabase.from("room_agents").delete().eq("id", agentId);
      if (error) throw new Error(`Agent löschen: ${error.message}`);
    },

    async listMessages(roomId) {
      const rows = unwrap(
        await supabase
          .from("messages")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true })
          .returns<ChatMessage[]>(),
        "Nachrichten laden",
      );
      return rows.map(normalizeMessage);
    },
    async insertMessage(message) {
      return normalizeMessage(
        unwrap(await supabase.from("messages").insert(message).select("*").single<ChatMessage>(), "Nachricht speichern"),
      );
    },
    async clearMessages(roomId) {
      const { error } = await supabase.from("messages").delete().eq("room_id", roomId);
      if (error) throw new Error(`Verlauf löschen: ${error.message}`);
      await this.updateRoomSummary(roomId, "", 0);
    },
  };
}
