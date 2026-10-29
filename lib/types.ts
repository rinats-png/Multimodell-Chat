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
  created_at: string;
}

/** Profil, wie es an den Browser geht – ohne Klartext-API-Key. */
export interface PublicProfile extends Omit<UserProfile, "custom_openrouter_key"> {
  has_custom_key: boolean;
  custom_key_hint: string | null;
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
  created_at: string;
}

export type NewChatMessage = Omit<ChatMessage, "id" | "created_at">;

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
  | { type: "summary"; summary: string; summarizedCount: number }
  | { type: "usage"; profile: PublicProfile }
  | { type: "error"; code: string; message: string }
  | { type: "done" };
