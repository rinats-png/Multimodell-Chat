import { streamText } from "ai";
import { composeDemoReply, createDemoModel } from "./ai/demo-model";
import { getLanguageModel, resolveApiKey, ROUTER_MODEL, SUMMARY_MODEL } from "./ai/provider";
import { applySlidingWindow, buildAgentMessages, stripSpeakerPrefix } from "./context-builder";
import { approxTokens, estimateCostUsd } from "./models";
import { findMentionedAgent, heuristicRoute, routeNextSpeaker, summarizeDroppedMessages } from "./router";
import { toPublicProfile } from "./session";
import type { DataStore } from "./store/types";
import { assertCanCallModel, UsageGuardError } from "./usage-guard";
import type { ChatMessage, ChatRoom, OrchestrateEvent, RoomAgent, UserProfile } from "./types";

export interface OrchestrateInput {
  store: DataStore;
  room: ChatRoom;
  agents: RoomAgent[];
  /** Direkt angeforderter Agent ("Lass Claude antworten"). */
  forcedAgentId: string | null;
  /** Gerade gespeicherte User-Nachricht (falls vorhanden) – für @Mentions. */
  userMessage: ChatMessage | null;
  emit: (event: OrchestrateEvent) => void;
  signal: AbortSignal;
}

/** Nach so vielen neu herausgefallenen Nachrichten wird das Langzeitgedächtnis aktualisiert. */
const SUMMARY_BATCH = 4;

/** Plant die Sprecher je nach Modus und führt die Turns nacheinander mit Streaming aus. */
export async function runOrchestration(input: OrchestrateInput): Promise<void> {
  const { store, room, emit, signal } = input;
  const activeAgents = input.agents.filter((a) => a.is_active);
  let messages = await store.listMessages(room.id);
  let profile = await store.getProfile();

  const forced =
    activeAgents.find((a) => a.id === input.forcedAgentId) ??
    (input.userMessage ? findMentionedAgent(input.userMessage.content, activeAgents) : null);

  if (activeAgents.length === 0) {
    emit({ type: "error", code: "no_agents", message: "In diesem Raum ist kein Agent aktiv." });
    return;
  }

  // ---- Sprecher-Plan ------------------------------------------------------
  const maxTurns = Math.max(1, room.max_auto_turns);
  type Planner = (turn: number) => Promise<RoomAgent | null>;
  let planner: Planner;

  if (forced) {
    // Manuell / @Mention übersteuert jeden Modus: genau ein Agent antwortet.
    planner = async (turn) => (turn === 0 ? forced : null);
  } else if (room.orchestration_mode === "manual") {
    emit({
      type: "router",
      agentId: null,
      reason: "Manueller Modus – erwähne einen Agenten mit @Name oder nutze die Schnell-Buttons.",
    });
    return;
  } else if (room.orchestration_mode === "round-robin") {
    const lastAgentIdx = activeAgents.findIndex((a) => a.id === messages.at(-1)?.agent_id);
    const start = input.userMessage ? 0 : lastAgentIdx + 1;
    planner = async (turn) => (turn < maxTurns ? activeAgents[(start + turn) % activeAgents.length]! : null);
  } else {
    planner = async (turn) => {
      if (turn >= maxTurns) return null;
      const apiKey = resolveApiKey(profile.custom_openrouter_key);
      let decision;
      if (apiKey) {
        await assertCanCallModel(profile);
        decision = await routeNextSpeaker(messages, activeAgents, apiKey, turn);
        const routerTokens = decision.inputTokens + decision.outputTokens;
        if (routerTokens > 0) {
          await store.incrementTokens(routerTokens);
          profile = { ...profile, tokens_used_this_month: profile.tokens_used_this_month + routerTokens };
        }
      } else {
        decision = heuristicRoute(messages, activeAgents, turn);
      }
      const agent = activeAgents.find((a) => a.id === decision.nextSpeakerId) ?? null;
      emit({ type: "router", agentId: agent?.id ?? null, reason: decision.reason });
      return agent;
    };
  }

  // ---- Turn-Schleife ------------------------------------------------------
  try {
    for (let turn = 0; ; turn++) {
      if (signal.aborted) break;
      const agent = await planner(turn);
      if (!agent) break;

      const message = await runAgentTurn({ store, room, agent, messages, profile, activeAgents, emit, signal });
      if (!message) break;
      messages = [...messages, message];
      profile = { ...profile, tokens_used_this_month: profile.tokens_used_this_month + message.input_tokens + message.output_tokens };
    }

    await maybeUpdateSummary(store, room, messages, profile, emit);
  } catch (error) {
    if (error instanceof UsageGuardError) {
      emit({ type: "error", code: error.code, message: error.message });
    } else if (!signal.aborted) {
      console.error("[orchestrate]", error);
      emit({ type: "error", code: "model_error", message: error instanceof Error ? error.message : "Unbekannter Fehler" });
    }
  }

  emit({ type: "usage", profile: toPublicProfile(await store.getProfile()) });
}

interface AgentTurnInput {
  store: DataStore;
  room: ChatRoom;
  agent: RoomAgent;
  messages: ChatMessage[];
  profile: UserProfile;
  activeAgents: RoomAgent[];
  emit: (event: OrchestrateEvent) => void;
  signal: AbortSignal;
}

async function runAgentTurn(input: AgentTurnInput): Promise<ChatMessage | null> {
  const { store, room, agent, messages, profile, activeAgents, emit, signal } = input;
  await assertCanCallModel(profile);

  const prompt = buildAgentMessages(agent, messages, room.sliding_window_size, {
    agents: activeAgents,
    runningSummary: room.running_summary,
  });

  const apiKey = resolveApiKey(profile.custom_openrouter_key);
  const model = apiKey
    ? getLanguageModel(agent.model_identifier, apiKey)
    : createDemoModel(
        agent.model_identifier,
        composeDemoReply({
          agentName: agent.display_name,
          roleTitle: agent.role_title,
          modelId: agent.model_identifier,
          lastSpeaker: messages.at(-1)?.sender_type === "agent" ? messages.at(-1)!.sender_name : null,
          lastContent: [...messages].reverse().find((m) => m.sender_type === "user")?.content ?? "",
        }),
        prompt.system + prompt.messages.map((m) => m.content).join("\n"),
      );

  const tempId = crypto.randomUUID();
  emit({ type: "turn-start", tempId, agentId: agent.id });

  const result = streamText({
    model,
    system: prompt.system,
    messages: prompt.messages,
    temperature: 0.8,
    maxOutputTokens: 700,
    abortSignal: signal,
  });

  let text = "";
  let prefixChecked = false;
  let pending = "";
  for await (const delta of result.textStream) {
    text += delta;
    if (!prefixChecked) {
      // Ein mögliches "[Name]:"-Präfix erst nach den ersten Zeichen entfernen.
      pending += delta;
      if (pending.length < 40 && !pending.includes("\n")) continue;
      prefixChecked = true;
      emit({ type: "delta", tempId, text: stripSpeakerPrefix(pending) });
      continue;
    }
    emit({ type: "delta", tempId, text: delta });
  }
  if (!prefixChecked && pending) emit({ type: "delta", tempId, text: stripSpeakerPrefix(pending) });

  const usage = await result.usage;
  const content = stripSpeakerPrefix(text).trim() || "(keine Antwort)";
  const inputTokens = usage.inputTokens ?? approxTokens(prompt.system + prompt.messages.map((m) => m.content).join(""));
  const outputTokens = usage.outputTokens ?? approxTokens(content);

  const saved = await store.insertMessage({
    room_id: room.id,
    sender_type: "agent",
    agent_id: agent.id,
    sender_name: agent.display_name,
    content,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: apiKey ? estimateCostUsd(agent.model_identifier, inputTokens, outputTokens) : 0,
  });
  await store.incrementTokens(inputTokens + outputTokens);
  emit({ type: "turn-end", tempId, message: saved });
  return saved;
}

/** Ältere Nachrichten, die aus dem Sliding Window fallen, ins Langzeitgedächtnis verdichten. */
async function maybeUpdateSummary(
  store: DataStore,
  room: ChatRoom,
  messages: ChatMessage[],
  profile: UserProfile,
  emit: (event: OrchestrateEvent) => void,
): Promise<void> {
  const outsideWindow = messages.length - applySlidingWindow(messages, room.sliding_window_size).length;
  if (outsideWindow - room.summarized_message_count < SUMMARY_BATCH) return;

  const dropped = messages.slice(room.summarized_message_count, outsideWindow);
  const apiKey = resolveApiKey(profile.custom_openrouter_key);
  if (apiKey) await assertCanCallModel(profile);
  const result = await summarizeDroppedMessages(room.running_summary, dropped, apiKey);
  await store.updateRoomSummary(room.id, result.summary, outsideWindow);
  const tokens = result.inputTokens + result.outputTokens;
  if (tokens > 0) await store.incrementTokens(tokens);
  emit({ type: "summary", summary: result.summary, summarizedCount: outsideWindow });
}

export const ORCHESTRATION_MODELS = { router: ROUTER_MODEL, summary: SUMMARY_MODEL };
