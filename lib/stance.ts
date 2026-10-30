import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel, ROUTER_MODEL, type ResolvedKey } from "./ai/provider";
import { logError } from "./log";
import type { ChatMessage, Stance } from "./types";

export interface StanceRating {
  stance: Stance;
  /** KI, auf die sich die Antwort bezieht */
  targetId: string;
  inputTokens: number;
  outputTokens: number;
}

/** Bewertet wird nur, wenn eine KI direkt auf die Antwort einer anderen KI folgt. */
export function stanceTarget(reply: ChatMessage, previous: ChatMessage | undefined): string | null {
  if (!previous || previous.sender_type !== "agent" || !previous.agent_id) return null;
  if (reply.sender_type !== "agent" || !reply.agent_id || reply.agent_id === previous.agent_id) return null;
  return previous.agent_id;
}

/** Schlüsselwort-Bewertung (Demo-Modus und Rückfall, falls das Bewertungs-Modell ausfällt). */
export function heuristicStance(text: string): Stance {
  const t = text.toLowerCase();
  if (/widersprech|nicht einverstanden|anderer meinung|zu knapp|unrealistisch|sehe ich anders|halte ich für (zu|falsch|riskant)|das stimmt nicht|da muss ich/.test(t)) return "disagree";
  if (/stimme zu|einverstanden|genau so|richtig,|sehe ich genauso|volle zustimmung|stimmt,/.test(t)) return "agree";
  if (/ergänze|ergänzend|zusätzlich|außerdem|dazu passt|darauf aufbauend|baue darauf|erweitere/.test(t)) return "extend";
  return "neutral";
}

const schema = z.object({
  stance: z.enum(["agree", "disagree", "extend", "neutral"]).describe("Wie die zweite Nachricht auf die erste Bezug nimmt"),
});

const MAX_CHARS = 1_200;
const clip = (s: string) => (s.length > MAX_CHARS ? `${s.slice(0, MAX_CHARS)} …` : s);

/**
 * Bewertet, ob die Antwort der vorherigen KI zustimmt, widerspricht, sie weiterführt oder neutral bleibt.
 * Ohne Zugang (Demo) oder bei Fehlern greift die Schlüsselwort-Bewertung; Rückgabe null, wenn nichts zu bewerten ist.
 */
export async function rateStance(
  reply: ChatMessage,
  previous: ChatMessage | undefined,
  access: ResolvedKey | null,
  signal?: AbortSignal,
): Promise<StanceRating | null> {
  const targetId = stanceTarget(reply, previous);
  if (!targetId || !previous) return null;
  if (!access?.apiKey) return { stance: heuristicStance(reply.content), targetId, inputTokens: 0, outputTokens: 0 };
  try {
    const { object, usage } = await generateObject({
      model: getLanguageModel(ROUTER_MODEL, access),
      schema,
      temperature: 0,
      maxOutputTokens: 30,
      abortSignal: signal,
      system:
        "Du bewertest einen Gruppenchat zwischen KIs. Gegeben sind eine erste und eine zweite Nachricht. " +
        "Entscheide, wie die zweite auf die erste Bezug nimmt: agree (stimmt der Kernaussage zu), disagree (widerspricht ihr), " +
        "extend (führt sie weiter, ohne zu widersprechen) oder neutral (kein erkennbarer Bezug).",
      prompt: `Erste Nachricht (${previous.sender_name}):\n${clip(previous.content)}\n\nZweite Nachricht (${reply.sender_name}):\n${clip(reply.content)}`,
    });
    return { stance: object.stance, targetId, inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 };
  } catch (error) {
    if (signal?.aborted) throw error;
    logError("stance.fallback", error, { model: ROUTER_MODEL });
    return { stance: heuristicStance(reply.content), targetId, inputTokens: 0, outputTokens: 0 };
  }
}
