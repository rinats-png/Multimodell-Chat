import { resolveModelAccess } from "./ai/provider";
import { logError, securityLog } from "./log";
import { toPublicProfile } from "./session";
import { PLANS } from "./plans";
import { activeAgentsFor, rateAndStoreStance, runAgentTurn, userFacingModelError, type OrchestrateInput } from "./orchestrator";
import { ROUTER_MODEL } from "./ai/provider";
import type { ChatMessage, UserProfile } from "./types";
import { UsageGuardError } from "./usage-guard";

/**
 * Automatische Ratssitzung (nach dem Roast-Room-Ablauf): drei Runden, in denen jede aktive KI nacheinander antwortet,
 * danach der Bericht. Jede Runde ist eine eigene Anfrage (der Browser kettet sie), damit sie in das Zeitlimit einer
 * Funktion passt. Die Runden unterscheiden sich nur durch die Aufgabe, die jede KI zusätzlich zu ihrer Rolle bekommt.
 */
export const COUNCIL_ROUND_COUNT = 3;
export const MIN_COUNCIL_AGENTS = 2;

export interface CouncilRoundDef {
  round: 1 | 2 | 3;
  title: string;
  instruction: string;
}

const RATING = `Schließe mit einer Zeile „Wertung: A x, B y, C z“ (0 bis 10, ein Wert je Option; gibt es keine Optionen, werte „ja“ und „nein“).`;

export const COUNCIL_ROUNDS: Record<1 | 2 | 3, CouncilRoundDef> = {
  1: {
    round: 1,
    title: "Eröffnung",
    instruction: `Runde 1 von 3: Eröffnung. Lies die Entscheidung des Menschen. Antworte in höchstens 120 Wörtern, in dieser Reihenfolge: (1) deine Empfehlung in einem Satz, (2) zwei Gründe aus deiner Fachrolle, (3) dein stärkster Einwand gegen deine eigene Empfehlung. ${RATING} Lass dich noch nicht von den anderen leiten.`,
  },
  2: {
    round: 2,
    title: "Streit",
    instruction: `Runde 2 von 3: Streit. Lies die Eröffnungen der anderen. Antworte in höchstens 120 Wörtern: (1) mit wem du am meisten nicht einverstanden bist und warum (nenne den Namen), (2) welchen Punkt eines anderen du gelten lässt und was er ändert, (3) ob du deine Meinung geändert hast und wie. Bewege dich nur für ein besseres Argument, nie aus Höflichkeit. ${RATING} Sind sich alle einig, suche den schwächsten Punkt der gemeinsamen Meinung.`,
  },
  3: {
    round: 3,
    title: "Abstimmung",
    instruction: `Runde 3 von 3: Abstimmung. Antworte in höchstens 70 Wörtern: (1) dein Votum für die Option, die insgesamt vorne liegt: Zustimmen, Zustimmen mit Änderung oder Widersprechen, (2) eine Bedingung oder dein Widerspruch in einem Satz, (3) ein Satz, den der Mensch nicht vergessen soll. ${RATING} Das ist deine endgültige Wertung.`,
  },
};

export function councilRoundLabel(round: 1 | 2 | 3): string {
  return `Runde ${round} von ${COUNCIL_ROUND_COUNT}: ${COUNCIL_ROUNDS[round].title}`;
}

/** Kontextfenster der Sitzung: so groß, dass auch in Runde 3 noch die Frage und die Eröffnungen sichtbar sind (im Rahmen des Tarifs). */
export function councilWindowSize(roomWindow: number, agentCount: number, tierMax: number): number {
  return Math.min(tierMax, Math.max(roomWindow, agentCount * 3 + 2));
}

/** Nach dieser Zeit beginnt keine weitere KI mehr in dieser Runde (Funktionslimit 120 s). */
const ROUND_TIME_BUDGET_MS = 90_000;

export interface CouncilRoundInput extends OrchestrateInput {
  round: 1 | 2 | 3;
}

/** Führt eine Runde der Ratssitzung aus: jede aktive KI antwortet einmal, in der Reihenfolge des Studios. */
export async function runCouncilRound(input: CouncilRoundInput): Promise<void> {
  const { store, room, emit, signal, round } = input;
  let messages: ChatMessage[] = await store.listMessages(room.id);
  let profile: UserProfile = await store.getProfile();
  const limits = PLANS[profile.subscription_tier].limits;
  const activeAgents = activeAgentsFor(input.agents, limits);

  if (activeAgents.length < MIN_COUNCIL_AGENTS) {
    emit({ type: "error", code: "council_needs_agents", message: "Eine Ratssitzung braucht mindestens zwei aktive KIs." });
    return;
  }
  const windowSize = councilWindowSize(room.sliding_window_size, activeAgents.length, limits.maxSlidingWindow);
  emit({ type: "router", agentId: null, reason: councilRoundLabel(round) });

  const accessFor = (modelId: string) => resolveModelAccess(profile, modelId, { allowPlatformKey: input.allowPlatformKey });
  let key = accessFor(activeAgents[0]!.model_identifier);
  try {
    const startedAt = Date.now();
    for (const [index, agent] of activeAgents.entries()) {
      if (signal.aborted) break;
      if (index > 0 && Date.now() - startedAt > ROUND_TIME_BUDGET_MS) break;
      key = accessFor(agent.model_identifier);
      const result = await runAgentTurn({
        store,
        room,
        agent,
        messages,
        profile,
        activeAgents,
        windowSize,
        key,
        emit,
        signal,
        instruction: COUNCIL_ROUNDS[round].instruction,
        skipRateLimit: true,
      });
      profile = { ...profile, tokens_used_this_month: profile.tokens_used_this_month + result.tokens };
      if (result.message && result.completed) {
        const rated = await rateAndStoreStance({ store, reply: result.message, previous: messages.at(-1), profile, access: accessFor(ROUTER_MODEL), emit, signal });
        profile = { ...profile, tokens_used_this_month: profile.tokens_used_this_month + rated };
      }
      if (result.message) messages = [...messages, result.message];
      if (!result.completed) break;
    }
  } catch (error) {
    if (error instanceof UsageGuardError) {
      securityLog(error.code, { userId: profile.id, roomId: room.id });
      emit({ type: "error", code: error.code, message: error.message });
    } else if (!signal.aborted) {
      logError("council.round", error, { userId: profile.id, roomId: room.id, round });
      emit({ type: "error", code: "model_error", message: userFacingModelError(error, key) });
    }
  }
  emit({ type: "usage", profile: toPublicProfile(await store.getProfile()) });
}
