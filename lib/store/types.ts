import type { PlatformSpend } from "../platform-budget";
import type { DecisionReport, ReportSummary, StoredReport } from "../report/schema";
import type {
  AgentPatch,
  ChatMessage,
  ChatRoom,
  NewChatMessage,
  NewRoomAgent,
  RoomAgent,
  ProviderKeyId,
  RoomSettingsPatch,
  Stance,
  SubscriptionTier,
  UserProfile,
} from "../types";

export interface UsageTotals {
  input: number;
  output: number;
  cost: number;
  replies: number;
}

export interface AccountExport {
  exported_at: string;
  profile: Omit<UserProfile, "custom_openrouter_key" | "provider_keys"> & { has_custom_key: boolean };
  rooms: (ChatRoom & { agents: RoomAgent[]; messages: ChatMessage[] })[];
  reports: StoredReport[];
}

/**
 * Datenzugriff – implementiert für Supabase (Produktion) und In-Memory (Demo).
 * Jede Instanz ist an genau einen angemeldeten Nutzer gebunden.
 * `custom_openrouter_key` und `provider_keys` sind im Rückgabewert immer entschlüsselt.
 */
export interface DataStore {
  getProfile(): Promise<UserProfile>;
  setCustomKey(key: string | null): Promise<UserProfile>;
  /** Weiteren eigenen Key setzen (null entfernt ihn); verschlüsselt gespeichert. */
  setProviderKey(id: ProviderKeyId, key: string | null): Promise<UserProfile>;
  /** Nur im Demo-Store erlaubt; in Produktion setzt der Billing-Webhook den Tarif. */
  setTier?(tier: SubscriptionTier): Promise<UserProfile>;
  incrementTokens(tokens: number): Promise<void>;
  /** Gemeinsamer Verbrauch mit dem Plattform-Key im laufenden Monat (alle Nutzer, nur Server). */
  getPlatformSpend(): Promise<PlatformSpend>;
  /** Bucht geschätzte Kosten (USD) eines Aufrufs mit dem Plattform-Key; `trial` für Testnutzer (Starter). */
  addPlatformSpend(costUsd: number, trial: boolean): Promise<void>;

  listRooms(): Promise<ChatRoom[]>;
  getRoom(roomId: string): Promise<ChatRoom | null>;
  createRoom(title?: string): Promise<ChatRoom>;
  updateRoom(roomId: string, patch: RoomSettingsPatch): Promise<ChatRoom>;
  updateRoomSummary(roomId: string, summary: string, summarizedCount: number): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;

  listAgents(roomId: string): Promise<RoomAgent[]>;
  /** null, wenn der Agent nicht existiert oder nicht dem Nutzer gehört. */
  getAgent(agentId: string): Promise<RoomAgent | null>;
  createAgent(agent: NewRoomAgent): Promise<RoomAgent>;
  /** null, wenn der Agent nicht existiert oder nicht dem Nutzer gehört. */
  updateAgent(agentId: string, patch: AgentPatch): Promise<RoomAgent | null>;
  /** false, wenn der Agent nicht existiert oder nicht dem Nutzer gehört. */
  deleteAgent(agentId: string): Promise<boolean>;

  listMessages(roomId: string): Promise<ChatMessage[]>;
  insertMessage(message: NewChatMessage): Promise<ChatMessage>;
  /** Hält fest, wie eine KI-Antwort auf eine andere Bezug nimmt. Nur eigene Nachrichten; sonst Fehler. */
  setMessageStance(messageId: string, stance: Stance, targetId: string): Promise<void>;
  clearMessages(roomId: string): Promise<void>;

  /** Entscheidungsberichte (F-21). Nur eigene; fremde IDs verhalten sich wie „nicht vorhanden“. */
  createReport(input: { room_id: string; title: string; report: DecisionReport }): Promise<StoredReport>;
  listReports(): Promise<ReportSummary[]>;
  getReport(reportId: string): Promise<StoredReport | null>;
  /** false, wenn der Bericht nicht existiert oder nicht dem Nutzer gehört. */
  deleteReport(reportId: string): Promise<boolean>;
  /** Hash des Freigabe-Tokens setzen (Link aktiv) oder null (Link widerrufen). false bei fremdem/unbekanntem Bericht. */
  setReportShare(reportId: string, tokenHash: string | null): Promise<boolean>;

  getUsageTotals(): Promise<UsageTotals>;
  exportAccount(): Promise<AccountExport>;
  /** Löscht das Konto inklusive aller Räume, Agenten und Nachrichten. */
  deleteAccount(): Promise<void>;
}
