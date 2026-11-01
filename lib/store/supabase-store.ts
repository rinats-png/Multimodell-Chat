import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptProviderKeys, decryptSecret, encryptProviderKeys, encryptSecret } from "../crypto";
import { defaultAgents } from "../default-agents";
import { logError } from "../log";
import type { PlatformSpend } from "../platform-budget";
import { reportSchema, summaryOf, type StoredReport } from "../report/schema";
import type { ChatMessage, ChatRoom, RoomAgent, UserProfile } from "../types";
import type { DataStore } from "./types";

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${what}: keine Daten`);
  return result.data;
}

/** Spalten, die der Client lesen darf (der Freigabe-Hash gehört nicht dazu). */
const REPORT_COLUMNS = "id, room_id, title, report, shared_at, created_at";

interface ReportRow {
  id: string;
  room_id: string;
  title: string;
  report: unknown;
  shared_at: string | null;
  created_at: string;
}

/** Gespeicherten Bericht erneut prüfen; ein beschädigter Eintrag wird übersprungen statt angezeigt. */
function toStoredReport(row: ReportRow): StoredReport | null {
  const parsed = reportSchema.safeParse(row.report);
  if (!parsed.success) {
    logError("report.invalid", new Error("Gespeicherter Bericht entspricht nicht dem Schema"), { reportId: row.id });
    return null;
  }
  return { id: row.id, room_id: row.room_id, title: row.title, report: parsed.data, shared: row.shared_at !== null, shared_at: row.shared_at, created_at: row.created_at };
}

function normalizeMessage(row: ChatMessage): ChatMessage {
  return { ...row, estimated_cost_usd: Number(row.estimated_cost_usd) };
}

/** Zeile aus der Datenbank: provider_keys ist dort ein verschlüsselter Text. */
type ProfileRow = Omit<UserProfile, "provider_keys"> & { provider_keys?: string | null };

function decryptedProfile(row: ProfileRow): UserProfile {
  return { ...row, custom_openrouter_key: decryptSecret(row.custom_openrouter_key), provider_keys: decryptProviderKeys(row.provider_keys) };
}

/**
 * Supabase-Store.
 * - `user`: Client mit der Sitzung des Nutzers – alle Lese- und Inhaltszugriffe laufen über RLS.
 * - `admin`: Service-Role-Client – nur für abrechnungsrelevante Schreibvorgänge (Ledger,
 *   Verbrauch, Profil, Konto löschen). Jede dieser Methoden filtert selbst auf `userId`
 *   bzw. prüft den Raum-Besitz vorher mit dem Nutzer-Client (Regel 2.1).
 */
export function createSupabaseStore(user: SupabaseClient, admin: SupabaseClient, userId: string): DataStore {
  async function assertOwnRoom(roomId: string): Promise<void> {
    const { data, error } = await user.from("chat_rooms").select("id").eq("id", roomId).maybeSingle();
    if (error) throw new Error(`Raum prüfen: ${error.message}`);
    if (!data) throw new Error("Raum nicht gefunden");
  }

  const store: DataStore = {
    async getProfile() {
      const { data, error } = await admin.rpc("roll_usage_period", { p_user_id: userId });
      if (error) throw new Error(`Profil laden: ${error.message}`);
      if (!data || !(data as UserProfile).id) throw new Error("Profil laden: kein Profil vorhanden");
      return decryptedProfile(data as ProfileRow);
    },
    async setCustomKey(key) {
      return decryptedProfile(
        unwrap(
          await admin
            .from("user_profiles")
            .update({ custom_openrouter_key: key ? encryptSecret(key) : null })
            .eq("id", userId)
            .select("*")
            .single<ProfileRow>(),
          "API-Key speichern",
        ),
      );
    },
    async setProviderKey(id, key) {
      const current = await store.getProfile();
      return decryptedProfile(
        unwrap(
          await admin
            .from("user_profiles")
            .update({ provider_keys: encryptProviderKeys({ ...current.provider_keys, [id]: key ?? undefined }) })
            .eq("id", userId)
            .select("*")
            .single<ProfileRow>(),
          "API-Key speichern",
        ),
      );
    },
    async incrementTokens(tokens) {
      const { error } = await admin.rpc("increment_token_usage", { p_user_id: userId, p_tokens: Math.max(0, Math.round(tokens)) });
      if (error) throw new Error(`Token-Verbrauch buchen: ${error.message}`);
    },
    async getPlatformSpend() {
      const { data, error } = await admin.rpc("get_platform_spend");
      if (error) throw new Error(`Plattform-Verbrauch laden: ${error.message}`);
      const row = (data ?? {}) as Partial<Record<keyof PlatformSpend, number | string>>;
      return { trial_usd: Number(row.trial_usd ?? 0), paid_usd: Number(row.paid_usd ?? 0) };
    },
    async addPlatformSpend(costUsd, trial) {
      const cost = Math.max(0, Math.round(costUsd * 1_000_000) / 1_000_000);
      if (cost === 0) return;
      const { error } = await admin.rpc("add_platform_spend", { p_cost_usd: cost, p_trial: trial });
      if (error) throw new Error(`Plattform-Verbrauch buchen: ${error.message}`);
    },

    async listRooms() {
      return unwrap(
        await user.from("chat_rooms").select("*").order("created_at", { ascending: false }).limit(100).returns<ChatRoom[]>(),
        "Räume laden",
      );
    },
    async getRoom(roomId) {
      const { data, error } = await user.from("chat_rooms").select("*").eq("id", roomId).maybeSingle<ChatRoom>();
      if (error) throw new Error(`Raum laden: ${error.message}`);
      return data;
    },
    async createRoom(title) {
      const room = unwrap(
        await user
          .from("chat_rooms")
          .insert({ user_id: userId, ...(title ? { title } : {}) })
          .select("*")
          .single<ChatRoom>(),
        "Raum anlegen",
      );
      const { error } = await user.from("room_agents").insert(defaultAgents().map((a) => ({ ...a, room_id: room.id })));
      if (error) throw new Error(`Standard-Agenten anlegen: ${error.message}`);
      return room;
    },
    async updateRoom(roomId, patch) {
      return unwrap(await user.from("chat_rooms").update(patch).eq("id", roomId).select("*").single<ChatRoom>(), "Raum speichern");
    },
    async updateRoomSummary(roomId, summary, summarizedCount) {
      await assertOwnRoom(roomId);
      const { error } = await admin
        .from("chat_rooms")
        .update({ running_summary: summary, summarized_message_count: summarizedCount })
        .eq("id", roomId)
        .eq("user_id", userId);
      if (error) throw new Error(`Zusammenfassung speichern: ${error.message}`);
    },
    async deleteRoom(roomId) {
      const { error } = await user.from("chat_rooms").delete().eq("id", roomId);
      if (error) throw new Error(`Raum löschen: ${error.message}`);
    },

    async listAgents(roomId) {
      return unwrap(
        await user.from("room_agents").select("*").eq("room_id", roomId).order("sort_order", { ascending: true }).returns<RoomAgent[]>(),
        "Agenten laden",
      );
    },
    async getAgent(agentId) {
      const { data, error } = await user.from("room_agents").select("*").eq("id", agentId).maybeSingle<RoomAgent>();
      if (error) throw new Error(`Agent laden: ${error.message}`);
      return data;
    },
    async createAgent(agent) {
      return unwrap(await user.from("room_agents").insert(agent).select("*").single<RoomAgent>(), "Agent anlegen");
    },
    async updateAgent(agentId, patch) {
      const { data, error } = await user.from("room_agents").update(patch).eq("id", agentId).select("*").maybeSingle<RoomAgent>();
      if (error) throw new Error(`Agent speichern: ${error.message}`);
      return data;
    },
    async deleteAgent(agentId) {
      const { data, error } = await user.from("room_agents").delete().eq("id", agentId).select("id");
      if (error) throw new Error(`Agent löschen: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async listMessages(roomId) {
      // PostgREST liefert höchstens 1000 Zeilen je Abruf: seitenweise laden, sonst fehlen in langen Debatten die neuesten Nachrichten.
      const PAGE = 1000;
      const all: ChatMessage[] = [];
      for (let from = 0; ; from += PAGE) {
        const rows = unwrap(
          await user
            .from("messages")
            .select("*")
            .eq("room_id", roomId)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1)
            .returns<ChatMessage[]>(),
          "Nachrichten laden",
        );
        all.push(...rows);
        if (rows.length < PAGE) break;
      }
      return all.map(normalizeMessage);
    },
    async insertMessage(message) {
      await assertOwnRoom(message.room_id);
      return normalizeMessage(
        unwrap(await admin.from("messages").insert(message).select("*").single<ChatMessage>(), "Nachricht speichern"),
      );
    },
    async setMessageStance(messageId, stance, targetId) {
      // Eigentum über RLS prüfen (user-Client sieht nur eigene Nachrichten), geschrieben wird mit dem Service-Role-Client.
      const own = await user.from("messages").select("id").eq("id", messageId).maybeSingle();
      if (own.error || !own.data) throw new Error("Nachricht nicht gefunden");
      const { error } = await admin.from("messages").update({ stance, stance_target_id: targetId }).eq("id", messageId);
      if (error) throw new Error(`Bewertung speichern: ${error.message}`);
    },
    async clearMessages(roomId) {
      const { error } = await user.from("messages").delete().eq("room_id", roomId);
      if (error) throw new Error(`Verlauf löschen: ${error.message}`);
      await store.updateRoomSummary(roomId, "", 0);
    },

    async getUsageTotals() {
      const { data, error } = await user.from("user_usage_totals").select("*").maybeSingle<{
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
        agent_replies: number;
      }>();
      if (error) throw new Error(`Verbrauch laden: ${error.message}`);
      return {
        input: Number(data?.input_tokens ?? 0),
        output: Number(data?.output_tokens ?? 0),
        cost: Number(data?.cost_usd ?? 0),
        replies: Number(data?.agent_replies ?? 0),
      };
    },
    async createReport(input) {
      await assertOwnRoom(input.room_id);
      const row = unwrap(
        await admin
          .from("decision_reports")
          .insert({ room_id: input.room_id, user_id: userId, title: input.title, report: input.report })
          .select(REPORT_COLUMNS)
          .single<ReportRow>(),
        "Bericht speichern",
      );
      const stored = toStoredReport(row);
      if (!stored) throw new Error("Bericht speichern: ungültiger Bericht");
      return stored;
    },
    async listReports() {
      const rows = unwrap(
        await user.from("decision_reports").select(REPORT_COLUMNS).order("created_at", { ascending: false }).limit(200).returns<ReportRow[]>(),
        "Berichte laden",
      );
      return rows.map(toStoredReport).filter((r): r is StoredReport => r !== null).map(summaryOf);
    },
    async getReport(reportId) {
      const { data, error } = await user.from("decision_reports").select(REPORT_COLUMNS).eq("id", reportId).maybeSingle<ReportRow>();
      if (error) throw new Error(`Bericht laden: ${error.message}`);
      return data ? toStoredReport(data) : null;
    },
    async deleteReport(reportId) {
      const { data, error } = await user.from("decision_reports").delete().eq("id", reportId).select("id");
      if (error) throw new Error(`Bericht löschen: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    async setReportShare(reportId, tokenHash) {
      // Besitz zuerst mit der Nutzer-Sitzung prüfen (RLS), erst dann mit dem Service-Role-Client schreiben.
      const { data: own, error: ownError } = await user.from("decision_reports").select("id").eq("id", reportId).maybeSingle();
      if (ownError) throw new Error(`Bericht prüfen: ${ownError.message}`);
      if (!own) return false;
      const { error } = await admin
        .from("decision_reports")
        .update({ share_token_hash: tokenHash, shared_at: tokenHash ? new Date().toISOString() : null })
        .eq("id", reportId)
        .eq("user_id", userId);
      if (error) throw new Error(`Freigabe speichern: ${error.message}`);
      return true;
    },

    async exportAccount() {
      const { custom_openrouter_key, provider_keys, ...profile } = await store.getProfile();
      const rooms = unwrap(
        await user.from("chat_rooms").select("*").order("created_at", { ascending: true }).returns<ChatRoom[]>(),
        "Räume exportieren",
      );
      return {
        exported_at: new Date().toISOString(),
        profile: { ...profile, has_custom_key: Boolean(custom_openrouter_key || Object.keys(provider_keys).length) },
        rooms: await Promise.all(
          rooms.map(async (room) => ({ ...room, agents: await store.listAgents(room.id), messages: await store.listMessages(room.id) })),
        ),
        reports: unwrap(
          await user.from("decision_reports").select(REPORT_COLUMNS).order("created_at", { ascending: true }).returns<ReportRow[]>(),
          "Berichte exportieren",
        )
          .map(toStoredReport)
          .filter((r): r is StoredReport => r !== null),
      };
    },
    async deleteAccount() {
      // Löscht auth.users → Kaskade auf user_profiles, chat_rooms, room_agents, messages, decision_reports.
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`Konto löschen: ${error.message}`);
    },
  };
  return store;
}
