export type SubscriptionTier = "free" | "pro" | "team";
export type OrchestrationMode = "router" | "round-robin" | "manual";
export type SenderType = "user" | "agent" | "system";

export interface UserProfile {
  id: string;
  subscription_tier: SubscriptionTier;
  monthly_token_limit: number;
  tokens_used_this_month: number;
  usage_period_start: string;
  rate_limit_per_min: number;
  custom_openrouter_key: string | null;
  /** Weitere eigene Zugänge (entschlüsselt; in der DB als ein verschlüsselter Wert gespeichert). */
  provider_keys: ProviderKeys;
  created_at: string;
}

/** Eigene Zugänge neben OpenRouter: ein Gateway und die großen Anbieter direkt. */
export const PROVIDER_KEY_IDS = ["gateway", "openai", "anthropic", "google", "xai"] as const;
export type ProviderKeyId = (typeof PROVIDER_KEY_IDS)[number];
export type ProviderKeys = Partial<Record<ProviderKeyId, string>>;
export type ConnectionId = "openrouter" | ProviderKeyId;

export interface ConnectionInfo {
  id: ConnectionId;
  /** Gekürzte Anzeige, z. B. "sk-or-v…abcd" – nie der ganze Key. */
  hint: string;
}

/** Profil, wie es an den Browser geht – ohne Klartext-API-Keys. */
export interface PublicProfile extends Omit<UserProfile, "custom_openrouter_key" | "provider_keys"> {
  /** true, wenn ein eigener Zugang ALLE Modelle abdeckt (OpenRouter oder Gateway). */
  has_custom_key: boolean;
  custom_key_hint: string | null;
  connections: ConnectionInfo[];
}

export interface ChatRoom {
  id: string;
  user_id: string;
  title: string;
  orchestration_mode: OrchestrationMode;
  sliding_window_size: number;
  max_auto_turns: number;
  running_summary: string;
  summarized_message_count: number;
  created_at: string;
}

export interface RoomAgent {
  id: string;
  room_id: string;
  model_identifier: string;
  display_name: string;
  role_title: string;
  system_prompt: string;
  is_active: boolean;
  sort_order: number;
}

/** Wie eine KI-Antwort auf die vorherige KI-Antwort Bezug nimmt. */
export type Stance = "agree" | "disagree" | "extend" | "neutral";

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_type: SenderType;
  agent_id: string | null;
  sender_name: string;
  content: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  /** null: nicht bewertet (Antwort auf den Menschen oder noch offen) */
  stance: Stance | null;
  /** KI, auf die sich die Antwort bezieht (nur mit stance gesetzt) */
  stance_target_id: string | null;
  created_at: string;
}

export type NewChatMessage = Omit<ChatMessage, "id" | "created_at" | "stance" | "stance_target_id">;

export type RoomSettingsPatch = Partial<
  Pick<ChatRoom, "title" | "orchestration_mode" | "sliding_window_size" | "max_auto_turns">
>;

export type AgentPatch = Partial<
  Pick<RoomAgent, "model_identifier" | "display_name" | "role_title" | "system_prompt" | "is_active" | "sort_order">
>;

export type NewRoomAgent = Omit<RoomAgent, "id">;

/** Events, die /api/orchestrate als NDJSON-Stream an den Client schickt. */
export type OrchestrateEvent =
  | { type: "user-message"; message: ChatMessage }
  | { type: "router"; agentId: string | null; reason: string }
  | { type: "turn-start"; tempId: string; agentId: string }
  | { type: "delta"; tempId: string; text: string }
  | { type: "turn-end"; tempId: string; message: ChatMessage | null }
  | { type: "stance"; messageId: string; stance: Stance; targetId: string }
  | { type: "summary"; summary: string; summarizedCount: number }
  | { type: "usage"; profile: PublicProfile }
  | { type: "error"; code: string; message: string }
  | { type: "done" };
