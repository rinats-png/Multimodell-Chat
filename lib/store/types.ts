import type {
  AgentPatch,
  ChatMessage,
  ChatRoom,
  NewChatMessage,
  NewRoomAgent,
  RoomAgent,
  RoomSettingsPatch,
  SubscriptionTier,
  UserProfile,
} from "../types";

/** Datenzugriff – implementiert für Supabase (Produktion) und In-Memory (Demo). */
export interface DataStore {
  getProfile(): Promise<UserProfile>;
  setCustomKey(key: string | null): Promise<UserProfile>;
  /** Nur im Demo-Store erlaubt; in Produktion setzt der Billing-Webhook den Tarif. */
  setTier?(tier: SubscriptionTier): Promise<UserProfile>;
  incrementTokens(tokens: number): Promise<void>;

  listRooms(): Promise<ChatRoom[]>;
  getRoom(roomId: string): Promise<ChatRoom | null>;
  createRoom(title?: string): Promise<ChatRoom>;
  updateRoom(roomId: string, patch: RoomSettingsPatch): Promise<ChatRoom>;
  updateRoomSummary(roomId: string, summary: string, summarizedCount: number): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;

  listAgents(roomId: string): Promise<RoomAgent[]>;
  createAgent(agent: NewRoomAgent): Promise<RoomAgent>;
  updateAgent(agentId: string, patch: AgentPatch): Promise<RoomAgent>;
  deleteAgent(agentId: string): Promise<void>;

  listMessages(roomId: string): Promise<ChatMessage[]>;
  insertMessage(message: NewChatMessage): Promise<ChatMessage>;
  clearMessages(roomId: string): Promise<void>;
}
