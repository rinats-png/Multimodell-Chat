import { APICallError, streamText } from "ai";
import { composeDemoReply, createDemoModel } from "./ai/demo-model";
import { LocalCliError } from "./ai/local-cli";
import { getLanguageModel, isOwnAccess, resolveModelAccess, ROUTER_MODEL, SUMMARY_MODEL, type ResolvedKey } from "./ai/provider";
import { applySlidingWindow, buildAgentMessages, estimatePromptTokens, stripSpeakerPrefix } from "./context-builder";
import { logError, securityLog } from "./log";
import { approxTokens, estimateCostUsd, isPlatformModel, MAX_OUTPUT_TOKENS } from "./models";
import { PLANS, type PlanLimits } from "./plans";
import { assertPlatformBudget, bookPlatformSpend, platformBudgetOk } from "./platform-budget";
import { findMentionedAgent, heuristicRoute, routeNextSpeaker, SUMMARY_MAX_OUTPUT_TOKENS, summarizeDroppedMessages } from "./router";
import { toPublicProfile } from "./session";
import { rateStance, stanceTarget } from "./stance";
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
/** Bewertung einer Antwort: geschätzter Verbrauch für die Kontingentprüfung. */
const STANCE_TOKEN_ESTIMATE = 700;
/** Zeitbudget einer Runde, nach dem keine weitere KI mehr beginnt (Funktionslimit 120 s). */
const ROUND_TIME_BUDGET_MS = 90_000;

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
  const accessFor = (modelId: string, p: UserProfile = profile) => resolveModelAccess(p, modelId, { allowPlatformKey: input.allowPlatformKey });
  // Zugang des zuletzt aufgerufenen Modells – für verständliche Fehlermeldungen.
  let key: ResolvedKey = accessFor(ROUTER_MODEL);

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
      const routerAccess = accessFor(ROUTER_MODEL);
      const routerBooks = !isOwnAccess(routerAccess.source);
      // Obergrenze des Plattform-Keys erreicht: ohne Modellaufruf per Schlüsselwörtern routen.
      const routerBudgetOk = routerAccess.source !== "platform" || (await platformBudgetOk(store, profile));
      if (routerAccess.apiKey && routerBudgetOk) {
        key = routerAccess;
        if (routerBooks) assertQuota(profile, ROUTER_TOKEN_ESTIMATE);
        try {
          decision = await routeNextSpeaker(messages, activeAgents, routerAccess, turn, signal);
        } catch (error) {
          // Z14-13: Abbruch während des Router-Aufrufs – Schätzung buchen, dann weiterreichen.
          if (routerBooks) await store.incrementTokens(ROUTER_TOKEN_ESTIMATE);
          await bookPlatformSpend(store, profile, routerAccess, ROUTER_MODEL, ROUTER_TOKEN_ESTIMATE, 0);
          throw error;
        }
        await bookPlatformSpend(store, profile, routerAccess, ROUTER_MODEL, decision.inputTokens, decision.outputTokens);
        const routerTokens = decision.inputTokens + decision.outputTokens;
        if (routerTokens > 0 && routerBooks) {
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
    const startedAt = Date.now();
    for (let turn = 0; ; turn++) {
      if (signal.aborted) break;
      // Nach ~90 s keine neue Antwort mehr beginnen: die Funktion darf höchstens 120 s laufen, ein Abbruch mittendrin
      // würde Verbrauch ungebucht lassen und die Runde bis zum Ablauf der Sperre blockieren.
      if (turn > 0 && Date.now() - startedAt > ROUND_TIME_BUDGET_MS) break;
      const agent = await planner(turn);
      if (!agent) break;

      key = accessFor(agent.model_identifier);
      const result = await runAgentTurn({ store, room, agent, messages, profile, activeAgents, windowSize, key, emit, signal });
      profile = { ...profile, tokens_used_this_month: profile.tokens_used_this_month + result.tokens };
      if (result.message && result.completed) {
        const rated = await rateAndStoreStance({ store, reply: result.message, previous: messages.at(-1), profile, access: accessFor(ROUTER_MODEL), emit, signal });
        profile = { ...profile, tokens_used_this_month: profile.tokens_used_this_month + rated };
      }
      if (result.message) messages = [...messages, result.message];
      if (!result.completed) break;
    }

    if (!signal.aborted && limits.runningSummary) {
      await maybeUpdateSummary({ store, room, messages, profile, key: accessFor(SUMMARY_MODEL), windowSize, emit, signal });
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
const SOURCE_NAMES: Partial<Record<ResolvedKey["source"], string>> = {
  byok: "OpenRouter",
  gateway: "Vercel AI Gateway",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
};

export function userFacingModelError(error: unknown, key: ResolvedKey): string {
  if (error instanceof LocalCliError) {
    if (error.reason === "not_found") return `${error.message}. Installiere das Programm und melde dich dort einmal an (siehe „Tarif & Verbrauch“ → Abo-Modus).`;
    if (error.reason === "timeout") return `${error.message}. Erhöhe bei Bedarf ABO_TIMEOUT_MS.`;
    return `Das lokale Programm ist mit einem Fehler beendet worden: ${error.message}`;
  }
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  const own = SOURCE_NAMES[key.source];
  if (own && (status === 401 || status === 403)) return `Dein ${own}-Zugang wurde abgelehnt. Prüfe ihn unter „Tarif & Verbrauch“.`;
  if (own && status === 402) return `Dein ${own}-Guthaben reicht für diese Anfrage nicht aus.`;
  if (status === 404) return "Für dieses Modell ist gerade kein Anbieter verfügbar, der deine Daten nicht speichert. Wähle im Agenten-Studio ein anderes Modell.";
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
      `Das Modell „${agent.model_identifier}“ ist nur mit eigenem Zugang nutzbar (OpenRouter verbinden oder API-Key). Wähle im Agenten-Studio ein Modell aus der Liste.`,
      403,
    );
  }

  const prompt = buildAgentMessages(agent, messages, windowSize, {
    agents: activeAgents,
    runningSummary: PLANS[profile.subscription_tier].limits.runningSummary ? room.running_summary : "",
  });
  const promptTokens = estimatePromptTokens(prompt);
  const ownAccess = isOwnAccess(key.source);
  // Harter Stopp: Ist die Obergrenze für den Plattform-Key erreicht, entsteht kein weiterer Aufruf.
  if (key.source === "platform") await assertPlatformBudget(store, profile);
  await assertCanCallModel(profile, promptTokens + MAX_OUTPUT_TOKENS, { ownAccess });

  const model = key.apiKey || key.source === "local"
    ? getLanguageModel(agent.model_identifier, key)
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
  // Z14-03: Bei Abbruch ist unbekannt, wie viel der Anbieter noch erzeugt (inkl. Reasoning-Tokens)
  // → konservativ die volle Ausgabe-Reservierung buchen.
  let outputTokens = reported?.outputTokens ?? (aborted ? Math.max(MAX_OUTPUT_TOKENS, approxTokens(partial)) : approxTokens(partial));
  if (failure && !aborted && !partial) {
    // Anbieter hat die Anfrage abgelehnt, bevor etwas generiert wurde – nichts angefallen.
    inputTokens = 0;
    outputTokens = 0;
  }
  // Eigener Zugang bezahlt selbst – nur Plattform- und Demo-Verbrauch zählt gegen das Kontingent.
  const tokens = ownAccess ? 0 : inputTokens + outputTokens;
  if (tokens > 0) await store.incrementTokens(tokens);
  await bookPlatformSpend(store, profile, key, agent.model_identifier, inputTokens, outputTokens);

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

interface StanceInput {
  store: DataStore;
  reply: ChatMessage;
  previous: ChatMessage | undefined;
  profile: UserProfile;
  access: ResolvedKey;
  emit: (event: OrchestrateEvent) => void;
  signal: AbortSignal;
}

/**
 * Bewertet nach einer KI-Antwort, ob sie der vorherigen KI zustimmt oder widerspricht, und speichert das Ergebnis.
 * Fehler beenden die Runde nie (die Antwort ist schon gespeichert). Gibt die gebuchten Tokens zurück.
 */
async function rateAndStoreStance({ store, reply, previous, profile, access, emit, signal }: StanceInput): Promise<number> {
  if (!stanceTarget(reply, previous)) return 0;
  const books = !isOwnAccess(access.source);
  // Reicht das Kontingent nicht, wird ohne Modellaufruf per Schlüsselwörtern bewertet.
  let usable: ResolvedKey | null = access.apiKey ? access : null;
  if (usable && books) {
    try {
      assertQuota(profile, STANCE_TOKEN_ESTIMATE);
      if (usable.source === "platform" && !(await platformBudgetOk(store, profile))) usable = null;
    } catch {
      usable = null;
    }
  }
  try {
    const rating = await rateStance(reply, previous, usable, signal);
    if (!rating) return 0;
    const tokens = books ? rating.inputTokens + rating.outputTokens : 0;
    if (tokens > 0) await store.incrementTokens(tokens);
    await bookPlatformSpend(store, profile, access, ROUTER_MODEL, rating.inputTokens, rating.outputTokens);
    await store.setMessageStance(reply.id, rating.stance, rating.targetId);
    reply.stance = rating.stance;
    reply.stance_target_id = rating.targetId;
    emit({ type: "stance", messageId: reply.id, stance: rating.stance, targetId: rating.targetId });
    return tokens;
  } catch (error) {
    // Abbruch während des Modellaufrufs: der Anbieter hat ihn womöglich schon berechnet → Schätzung buchen (wie beim Router)
    if (signal.aborted && usable && books) {
      await store.incrementTokens(STANCE_TOKEN_ESTIMATE).catch((e) => logError("stance.book", e));
      await bookPlatformSpend(store, profile, usable, ROUTER_MODEL, STANCE_TOKEN_ESTIMATE, 0);
      return STANCE_TOKEN_ESTIMATE;
    }
    if (!signal.aborted) logError("stance", error, { roomId: reply.room_id });
    return 0;
  }
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

  const estimate = 2_000 + SUMMARY_MAX_OUTPUT_TOKENS;
  let called = false;
  try {
    const dropped = messages.slice(alreadySummarized, outsideWindow);
    const books = !isOwnAccess(key.source);
    if (key.apiKey && books) assertQuota(profile, estimate);
    // Obergrenze des Plattform-Keys erreicht: die Zusammenfassung wartet, bis ein eigener Zugang oder der nächste Monat da ist.
    if (key.source === "platform" && !(await platformBudgetOk(store, profile))) return;
    called = Boolean(key.apiKey) && books;
    const result = await summarizeDroppedMessages(room.running_summary, dropped, key.apiKey ? key : null, signal);
    called = false;
    const tokens = books ? result.inputTokens + result.outputTokens : 0;
    if (tokens > 0) await store.incrementTokens(tokens);
    await bookPlatformSpend(store, profile, key, SUMMARY_MODEL, result.inputTokens, result.outputTokens);
    await store.updateRoomSummary(room.id, result.summary, outsideWindow);
    emit({ type: "summary", summary: result.summary, summarizedCount: outsideWindow });
  } catch (error) {
    // BF-05: Die Antworten sind bereits gespeichert – ein Summary-Fehler beendet die Runde nicht.
    // Z14-13: Ein begonnener Aufruf wird mit der Schätzung gebucht.
    if (called) {
      await store.incrementTokens(estimate).catch((e) => logError("summary.book", e));
      await bookPlatformSpend(store, profile, key, SUMMARY_MODEL, estimate, 0);
    }
    if (!signal.aborted) logError("summary", error, { roomId: room.id });
  }
}
