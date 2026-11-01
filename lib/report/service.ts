import { generateRawReport, REPORT_TOKEN_ESTIMATE, simulatedRawReport, type GeneratedReport } from "./generate";
import { reportSchema, type StoredReport } from "./schema";
import { ReportScoringError, scoreReport } from "./score";
import { isOwnAccess, resolveModelAccess, SUMMARY_MODEL } from "../ai/provider";
import { HttpError } from "../api";
import { logError } from "../log";
import { PLANS } from "../plans";
import { assertPlatformBudget, bookPlatformSpend } from "../platform-budget";
import type { DataStore } from "../store/types";
import type { ChatRoom, RoomAgent } from "../types";
import { assertCanCallModel } from "../usage-guard";

export const MIN_AGENT_REPLIES_FOR_REPORT = 2;

export interface CreateReportInput {
  store: DataStore;
  room: ChatRoom;
  agents: RoomAgent[];
  /** Darf der Plattform-Key genutzt werden? (Demo-Workspace in Produktion: nein) */
  allowPlatformKey: boolean;
  signal: AbortSignal;
}

/**
 * Erstellt und speichert den Entscheidungsbericht einer Debatte.
 * Kosten und Grenzen wie bei jedem Modellaufruf: Tarifgrenze für Berichte, Kontingent, Ausgabenobergrenze des
 * Plattform-Keys, Minutenlimit. Der Starter ist vom Token-Kontingent ausgenommen (der Bericht ist der Kern des Testlaufs),
 * aber auf 3 Berichte begrenzt und zählt gegen die Testnutzer-Obergrenze. Ohne Zugang entsteht ein als „simuliert“
 * gekennzeichneter Bericht ohne Modellaufruf.
 */
export async function createReportForRoom(input: CreateReportInput): Promise<StoredReport> {
  const { store, room, agents, allowPlatformKey, signal } = input;
  const messages = await store.listMessages(room.id);
  const replies = messages.filter((m) => m.sender_type === "agent").length;
  if (replies < MIN_AGENT_REPLIES_FOR_REPORT) {
    throw new HttpError(400, "not_enough_debate", "Für einen Bericht braucht es mindestens zwei Antworten der KIs. Lass sie zuerst debattieren.");
  }

  const profile = await store.getProfile();
  const plan = PLANS[profile.subscription_tier];
  if ((await store.listReports()).length >= plan.limits.maxReports) {
    throw new HttpError(402, "plan_limit", `Dein Tarif ${plan.name} erlaubt bis zu ${plan.limits.maxReports} Berichte. Lösche einen alten oder wechsle den Tarif.`);
  }

  const access = resolveModelAccess(profile, SUMMARY_MODEL, { allowPlatformKey });
  let generated: GeneratedReport;
  if (access.apiKey) {
    const ownAccess = isOwnAccess(access.source);
    if (access.source === "platform") await assertPlatformBudget(store, profile);
    // Starter: kein Token-Kontingent für den Bericht (siehe oben); Minutenlimit gilt immer.
    await assertCanCallModel(profile, REPORT_TOKEN_ESTIMATE, { ownAccess: ownAccess || plan.trialOnly });
    try {
      generated = await generateRawReport(messages, agents, access, signal);
    } catch (error) {
      if (signal.aborted) {
        // Abbruch: der Anbieter hat womöglich schon gerechnet → Schätzung buchen (wie bei Router und Zusammenfassung).
        if (!ownAccess) await store.incrementTokens(REPORT_TOKEN_ESTIMATE).catch((e) => logError("report.book", e));
        await bookPlatformSpend(store, profile, access, SUMMARY_MODEL, REPORT_TOKEN_ESTIMATE, 0);
        throw new HttpError(499, "aborted", "Abgebrochen");
      }
      logError("report.generate", error, { userId: profile.id, roomId: room.id });
      throw new HttpError(502, "model_error", "Der Bericht konnte gerade nicht erstellt werden. Bitte versuche es später erneut.");
    }
    if (!ownAccess) await store.incrementTokens(generated.inputTokens + generated.outputTokens);
    await bookPlatformSpend(store, profile, access, SUMMARY_MODEL, generated.inputTokens, generated.outputTokens);
  } else {
    generated = simulatedRawReport(messages, agents);
  }

  const participants = [...new Set([...agents.filter((a) => a.is_active).map((a) => a.display_name), ...messages.filter((m) => m.sender_type === "agent").map((m) => m.sender_name)])];
  let scored;
  try {
    scored = scoreReport(generated.raw, participants);
  } catch (error) {
    if (error instanceof ReportScoringError) {
      throw new HttpError(422, "report_unusable", `${error.message} Lass die KIs ihre Einschätzung der Optionen noch einmal begründen und erstelle den Bericht erneut.`);
    }
    throw error;
  }

  const report = reportSchema.parse({
    version: 1,
    generatedAt: new Date().toISOString(),
    simulated: generated.simulated,
    agents: participants.map((p) => p.slice(0, 40)),
    ...scored,
  });
  return store.createReport({ room_id: room.id, title: report.question.slice(0, 160), report });
}
