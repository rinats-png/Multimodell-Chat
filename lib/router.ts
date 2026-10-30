import { generateObject, generateText } from "ai";
import { z } from "zod";
import { buildTranscript } from "./context-builder";
import { getLanguageModel, ROUTER_MODEL, SUMMARY_MODEL, type ResolvedKey } from "./ai/provider";
import { logError } from "./log";
import { approxTokens } from "./models";
import type { ChatMessage, RoomAgent } from "./types";

export const USER_TURN = "USER";

export interface RouterDecision {
  nextSpeakerId: string | null;
  reason: string;
  inputTokens: number;
  outputTokens: number;
}

const routerSchema = z.object({
  nextSpeakerId: z.string().describe(`ID des nächsten Agenten oder "${USER_TURN}", wenn der Mensch wieder dran ist`),
  reason: z.string().describe("Kurze Begründung (max. 12 Wörter)"),
});

const ROUTER_CONTEXT_SIZE = 4;

/** Findet den Agenten, der per @Mention im Text angesprochen wird. */
export function findMentionedAgent(text: string, agents: RoomAgent[]): RoomAgent | null {
  const mentions = [...text.matchAll(/@([\p{L}\p{N}._-]+)/gu)].map((m) => m[1]!.toLowerCase());
  if (mentions.length === 0) return null;
  for (const mention of mentions) {
    const agent = agents.find((a) => {
      const name = a.display_name.toLowerCase().replace(/\s+/g, "");
      return name === mention || name.startsWith(mention) || a.display_name.toLowerCase().split(/\s+/)[0] === mention;
    });
    if (agent) return agent;
  }
  return null;
}

/** Heuristischer Router (Demo-Modus & Fallback, falls das Router-Modell ungültiges JSON liefert). */
export function heuristicRoute(messages: ChatMessage[], agents: RoomAgent[], turnIndex: number): RouterDecision {
  const last = messages[messages.length - 1];
  const text = last?.content.toLowerCase() ?? "";
  const pick = (re: RegExp, provider: string) =>
    agents.find((a) => a.model_identifier.startsWith(provider) || re.test(a.role_title));

  let agent: RoomAgent | undefined;
  let reason = "";
  if (/architekt|sicherheit|security|skalier|risiko|datenbank|api|backend/.test(text)) {
    agent = pick(/architekt|kritisch/i, "anthropic");
    reason = "Es geht um Architektur und Risiken";
  } else if (/idee|kreativ|alternative|fazit|zusammenfass|vision/.test(text)) {
    agent = pick(/synth|kreativ/i, "google");
    reason = "Kreative Synthese gefragt";
  } else if (/mvp|markt|preis|kunde|business|launch|umsatz/.test(text)) {
    agent = pick(/strateg|produkt/i, "openai");
    reason = "Business- und Produktfrage";
  }

  // Niemals denselben Agenten zweimal in Folge wählen.
  if (!agent || (last?.sender_type === "agent" && last.agent_id === agent.id)) {
    const lastIdx = agents.findIndex((a) => a.id === last?.agent_id);
    // Nach einer KI-Antwort: die nächste KI in der Reihenfolge; nach dem Menschen: reihum je Turn.
    agent = agents[(lastIdx >= 0 ? lastIdx + 1 : turnIndex) % agents.length];
    // Die Themen-Begründung gehört zur ursprünglich gewählten KI – beim Ausweichen neutral begründen.
    reason = "Nächste Perspektive in der Runde";
  }
  return { nextSpeakerId: agent?.id ?? null, reason, inputTokens: 0, outputTokens: 0 };
}

/** KI-Moderator: wählt per strukturiertem JSON den nächsten Sprecher. */
export async function routeNextSpeaker(
  messages: ChatMessage[],
  agents: RoomAgent[],
  access: ResolvedKey,
  turnIndex: number,
  signal?: AbortSignal,
): Promise<RouterDecision> {
  const recent = messages.slice(-ROUTER_CONTEXT_SIZE);
  const roster = agents.map((a) => `- id: ${a.id} | ${a.display_name} – ${a.role_title}`).join("\n");

  try {
    const { object, usage } = await generateObject({
      model: getLanguageModel(ROUTER_MODEL, access),
      schema: routerSchema,
      temperature: 0,
      maxOutputTokens: 120,
      abortSignal: signal,
      system:
        "Du bist der Moderator eines Gruppenchats zwischen einem Menschen und mehreren KIs. " +
        "Wähle anhand der letzten Nachrichten, welche KI fachlich als Nächstes am meisten beitragen kann. " +
        "Wähle nie dieselbe KI, die gerade gesprochen hat. " +
        `Gib "${USER_TURN}" zurück, wenn die Frage beantwortet ist und der Mensch entscheiden sollte.`,
      prompt: `Verfügbare KIs:\n${roster}\n\nLetzte Nachrichten:\n${buildTranscript(recent.map(truncateMessage))}`,
    });
    const valid = object.nextSpeakerId === USER_TURN || agents.some((a) => a.id === object.nextSpeakerId);
    if (!valid) return heuristicRoute(messages, agents, turnIndex);
    return {
      nextSpeakerId: object.nextSpeakerId === USER_TURN ? null : object.nextSpeakerId,
      reason: object.reason,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    logError("router.fallback", error, { model: ROUTER_MODEL });
    // Z14-13: Der fehlgeschlagene Aufruf kann Kosten verursacht haben – Eingabe schätzen und buchen lassen.
    return { ...heuristicRoute(messages, agents, turnIndex), inputTokens: approxTokens(buildTranscript(recent.map(truncateMessage))) + 200 };
  }
}

/** Router & Summary sehen jede Nachricht höchstens in dieser Länge (Kosten-Bremse, BF-29). */
const MAX_CHARS_PER_MESSAGE = 1_500;
/** Höchstens so viele herausgefallene Nachrichten gehen in einen Summary-Aufruf. */
export const MAX_SUMMARY_INPUT_MESSAGES = 30;
export const SUMMARY_MAX_OUTPUT_TOKENS = 300;
const MAX_SUMMARY_CHARS = 1_500;

function truncateMessage(m: ChatMessage): ChatMessage {
  return m.content.length > MAX_CHARS_PER_MESSAGE ? { ...m, content: `${m.content.slice(0, MAX_CHARS_PER_MESSAGE)} …` } : m;
}

export interface SummaryResult {
  summary: string;
  inputTokens: number;
  outputTokens: number;
}

/** Fasst Nachrichten, die aus dem Sliding Window fallen, mit dem bisherigen Gedächtnis zusammen. */
export async function summarizeDroppedMessages(
  previousSummary: string,
  droppedAll: ChatMessage[],
  access: ResolvedKey | null,
  signal?: AbortSignal,
): Promise<SummaryResult> {
  const dropped = droppedAll.slice(-MAX_SUMMARY_INPUT_MESSAGES).map(truncateMessage);
  if (!access?.apiKey) {
    const lines = dropped.slice(-3).map((m) => `${m.sender_name}: ${m.content.replace(/\s+/g, " ").slice(0, 90)}…`);
    return { summary: [previousSummary, ...lines].filter(Boolean).join(" ").slice(-900), inputTokens: 0, outputTokens: 0 };
  }
  const { text, usage } = await generateText({
    model: getLanguageModel(SUMMARY_MODEL, access),
    temperature: 0.2,
    maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
    abortSignal: signal,
    system:
      "Du komprimierst Gruppenchat-Verläufe. Fasse in maximal 3 Sätzen zusammen: Kernfrage, wichtigste Positionen " +
      "(mit Namen der Sprecher) und offene Streitpunkte. Keine Einleitung.",
    prompt: `Bisherige Zusammenfassung:\n${previousSummary.slice(0, MAX_SUMMARY_CHARS) || "(leer)"}\n\nNeue ältere Nachrichten:\n${buildTranscript(dropped)}`,
  });
  return {
    summary: text.trim().slice(0, MAX_SUMMARY_CHARS),
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
  };
}
