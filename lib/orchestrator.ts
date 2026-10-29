import { APICallError, streamText } from "ai";
import { composeDemoReply, createDemoModel } from "./ai/demo-model";
import { getLanguageModel, resolveApiKey, type ResolvedKey } from "./ai/provider";
import { applySlidingWindow, buildAgentMessages, estimatePromptTokens, stripSpeakerPrefix } from "./context-builder";
import { logError, securityLog } from "./log";
import { approxTokens, estimateCostUsd, isPlatformModel, MAX_OUTPUT_TOKENS } from "./models";
import { PLANS, type PlanLimits } from "./plans";
import { findMentionedAgent, heuristicRoute, routeNextSpeaker, SUMMARY_MAX_OUTPUT_TOKENS, summarizeDroppedMessages } from "./router";
import { toPublicProfile } from "./session";
import type { DataStore } from "./store/types";
import type { ChatMessage, ChatRoom, OrchestrateEvent, RoomAgent, UserProfile } from "./types";
import { assertCanCallModel, assertQuota, UsageGuardError } from "./usage-guard";

export interface OrchestrateInput {
  store: DataStore;
  room: ChatRoom;
  agents: RoomAgent[];
  /** Direkt angeforderter Agent ("Lass Claude antworten"). */
  forcedAgentId: string | null;
  /** Gerade gespeicherte User-Nachricht (falls vorhanden) – für @Mentions. */
  userMessage: ChatMessage | null;
  /** Darf der Plattform-Key genutzt werden? (Demo-Workspace in Produktion: nein) */
  allowPlatformKey: boolean;
  emit: (event: OrchestrateEvent) => void;
  signal: AbortSignal;
}

/** Nach so vielen neu herausgefallenen Nachrichten wird das Langzeitgedächtnis aktualisiert. */
const SUMMARY_BATCH = 4;
/** Router-Aufruf: geschätzter Verbrauch für die Kontingentprüfung. */
const ROUTER_TOKEN_ESTIMATE = 800;

/** Tarifgrenzen, die der Raum (über die REST-API veränderbar) nie überschreiten darf (BF-28). */
export function effectiveRoomSettings(room: ChatRoom, limits: PlanLimits) {
  return {
    maxTurns: Math.max(1, Math.min(room.max_auto_turns, limits.maxAutoTurns)),
    windowSize: Math.max(2, Math.min(room.sliding_window_size, limits.maxSlidingWindow)),
  };
}

/** Aktive Agenten in Reihenfolge, begrenzt auf die Tarifgrenze. */
export function activeAgentsFor(agents: RoomAgent[], limits: PlanLimits): RoomAgent[] {
  return [...agents]
    .filter((a) => a.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, limits.maxActiveAgents);
}

/** Plant die Sprecher je nach Modus und führt die Turns nacheinander mit Streaming aus. */
export async function runOrchestration(input: OrchestrateInput): Promise<void> {
  const { store, room, emit, signal } = input;
  let messages = await store.listMessages(room.id);
  let profile = await store.getProfile();
  const limits = PLANS[profile.subscription_tier].limits;
  const { maxTurns, windowSize } = effectiveRoomSettings(room, limits);
  const activeAgents = activeAgentsFor(input.agents, limits);
  const key = resolveApiKey(profile, { allowPlatformKey: input.allowPlatformKey });

  if (activeAgents.length === 0) {
    emit({ type: "error", code: "no_agents", message: "In diesem Raum ist kein Agent aktiv." });
    return;
  }

  const forced =
    activeAgents.find((a) => a.id === input.forcedAgentId) ??
    (input.userMessage ? findMentionedAgent(input.userMessage.content, activeAgents) : null);

  // ---- Sprecher-Plan ------------------------------------------------------
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
    emit({ type: "usage", profile: toPublicProfile(profile) });
    return;
  } else if (room.orchestration_mode === "round-robin") {
    const lastAgentIdx = activeAgents.findIndex((a) => a.id === messages.at(-1)?.agent_id);
    const start = input.userMessage ? 0 : lastAgentIdx + 1;
    planner = async (turn) => (turn < maxTurns ? activeAgents[(start + turn) % activeAgents.length]! : null);
  } else {
    planner = async (turn) => {
      if (turn >= maxTurns) return null;
      let decision;
      if (key.apiKey) {
        assertQuota(profile, ROUTER_TOKEN_ESTIMATE);
        decision = await routeNextSpeaker(messages, activeAgents, key.apiKey, turn, signal);
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

      const result = await runAgentTurn({ store, room, agent, messages, profile, activeAgents, windowSize, key, emit, signal });
      profile = { ...profile, tokens_used_this_month: profile.tokens_used_this_month + result.tokens };
      if (result.message) messages = [...messages, result.message];
      if (!result.completed) break;
    }

    if (!signal.aborted && limits.runningSummary) {
      await maybeUpdateSummary({ store, room, messages, profile, key, windowSize, emit, signal });
    }
  } catch (error) {
    if (error instanceof UsageGuardError) {
      securityLog(error.code, { userId: profile.id, roomId: room.id });
      emit({ type: "error", code: error.code, message: error.message });
    } else if (!signal.aborted) {
      logError("orchestrate", error, { userId: profile.id, roomId: room.id });
      emit({ type: "error", code: "model_error", message: userFacingModelError(error, key) });
    }
  }

  emit({ type: "usage", profile: toPublicProfile(await store.getProfile()) });
}

/** Verständliche, aber nicht technische Fehlermeldung (Regel 9.3, BF-10). */
export function userFacingModelError(error: unknown, key: ResolvedKey): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  if (key.source === "byok" && (status === 401 || status === 403)) return "Dein OpenRouter-Key wurde abgelehnt. Prüfe ihn unter „Tarif & Verbrauch“.";
  if (key.source === "byok" && status === 402) return "Dein OpenRouter-Guthaben reicht für diese Anfrage nicht aus.";
  if (status === 429) return "Der KI-Anbieter ist gerade ausgelastet. Bitte versuche es in einer Minute erneut.";
  return "Das Modell konnte gerade nicht antworten. Bitte versuche es später erneut.";
}

interface AgentTurnInput {
  store: DataStore;
  room: ChatRoom;
  agent: RoomAgent;
  messages: ChatMessage[];
  profile: UserProfile;
  activeAgents: RoomAgent[];
  windowSize: number;
  key: ResolvedKey;
  emit: (event: OrchestrateEvent) => void;
  signal: AbortSignal;
}

interface AgentTurnResult {
  message: ChatMessage | null;
  /** Gebuchte Tokens dieses Turns */
  tokens: number;
  /** false bei Abbruch – die Runde endet */
  completed: boolean;
}

async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const { store, room, agent, messages, profile, activeAgents, windowSize, key, emit, signal } = input;

  if (key.source === "platform" && !isPlatformModel(agent.model_identifier)) {
    throw new UsageGuardError(
      "model_not_allowed",
      `Das Modell „${agent.model_identifier}“ ist nur mit eigenem OpenRouter-Key (Workspace-Tarif) nutzbar. Wähle im Agenten-Studio ein Modell aus der Liste.`,
      403,
    );
  }

  const prompt = buildAgentMessages(agent, messages, windowSize, {
    agents: activeAgents,
    runningSummary: PLANS[profile.subscription_tier].limits.runningSummary ? room.running_summary : "",
  });
  const promptTokens = estimatePromptTokens(prompt);
  await assertCanCallModel(profile, promptTokens + MAX_OUTPUT_TOKENS);

  const model = key.apiKey
    ? getLanguageModel(agent.model_identifier, key.apiKey)
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
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: signal,
  });

  let text = "";
  let failure: unknown = null;
  let prefixChecked = false;
  let pending = "";
  try {
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
  } catch (error) {
    failure = error;
  }

  const aborted = signal.aborted;
  // BF-04: Verbrauch IMMER buchen – auch bei Abbruch. Gemeldete Werte, sonst Schätzung.
  const reported = failure || aborted ? null : await result.usage.catch(() => null);
  const partial = stripSpeakerPrefix(text).trim();
  let inputTokens = reported?.inputTokens ?? promptTokens;
  let outputTokens = reported?.outputTokens ?? approxTokens(partial);
  if (failure && !aborted && !partial) {
    // Anbieter hat die Anfrage abgelehnt, bevor etwas generiert wurde – nichts angefallen.
    inputTokens = 0;
    outputTokens = 0;
  }
  const tokens = inputTokens + outputTokens;
  if (tokens > 0) await store.incrementTokens(tokens);

  let saved: ChatMessage | null = null;
  if (partial || !failure) {
    const content = partial
      ? failure || aborted
        ? `${partial}\n\n_(abgebrochen)_`
        : partial
      : "(keine Antwort)";
    saved = await store.insertMessage({
      room_id: room.id,
      sender_type: "agent",
      agent_id: agent.id,
      sender_name: agent.display_name,
      content,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: key.source === "demo" ? 0 : estimateCostUsd(agent.model_identifier, inputTokens, outputTokens),
    });
  }
  emit({ type: "turn-end", tempId, message: saved });

  if (failure && !aborted) throw failure;
  return { message: saved, tokens, completed: !aborted };
}

interface SummaryInput {
  store: DataStore;
  room: ChatRoom;
  messages: ChatMessage[];
  profile: UserProfile;
  key: ResolvedKey;
  windowSize: number;
  emit: (event: OrchestrateEvent) => void;
  signal: AbortSignal;
}

/** Ältere Nachrichten, die aus dem Sliding Window fallen, ins Langzeitgedächtnis verdichten. */
async function maybeUpdateSummary({ store, room, messages, profile, key, windowSize, emit, signal }: SummaryInput): Promise<void> {
  const outsideWindow = messages.length - applySlidingWindow(messages, windowSize).length;
  // Fenster vergrößert oder Verlauf gekürzt → Zähler darf nicht über den Rand hinaus zeigen (BF-29).
  const alreadySummarized = Math.min(room.summarized_message_count, outsideWindow);
  if (outsideWindow - alreadySummarized < SUMMARY_BATCH) return;

  try {
    const dropped = messages.slice(alreadySummarized, outsideWindow);
    if (key.apiKey) assertQuota(profile, 2_000 + SUMMARY_MAX_OUTPUT_TOKENS);
    const result = await summarizeDroppedMessages(room.running_summary, dropped, key.apiKey, signal);
    const tokens = result.inputTokens + result.outputTokens;
    if (tokens > 0) await store.incrementTokens(tokens);
    await store.updateRoomSummary(room.id, result.summary, outsideWindow);
    emit({ type: "summary", summary: result.summary, summarizedCount: outsideWindow });
  } catch (error) {
    // BF-05: Die Antworten sind bereits gespeichert – ein Summary-Fehler beendet die Runde nicht.
    if (!signal.aborted) logError("summary", error, { roomId: room.id });
  }
}
