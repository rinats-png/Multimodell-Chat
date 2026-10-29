import { effectiveCustomKey } from "./ai/provider";
import { HttpError } from "./api";
import { isPlatformModel } from "./models";
import { PLANS } from "./plans";
import type { RoomAgent, UserProfile } from "./types";

/** Modellwahl: mit Plattform-Key nur Katalog-Modelle (BF-02). Beim Modellaufruf wird erneut geprüft. */
export function assertModelAllowed(profile: UserProfile, modelId: string | undefined): void {
  if (modelId === undefined || isPlatformModel(modelId) || effectiveCustomKey(profile)) return;
  throw new HttpError(403, "model_not_allowed", "Freie Modell-IDs sind nur mit eigenem OpenRouter-Key (Workspace-Tarif) möglich. Wähle ein Modell aus der Liste.");
}

/** Anzahl aktiver Agenten je Raum nach Tarif (BF-28). */
export function assertActiveAgentLimit(profile: UserProfile, agents: RoomAgent[], activating: boolean): void {
  if (!activating) return;
  const { limits, name } = PLANS[profile.subscription_tier];
  if (agents.filter((a) => a.is_active).length >= limits.maxActiveAgents) {
    throw new HttpError(402, "plan_limit", `Im Tarif ${name} sind höchstens ${limits.maxActiveAgents} aktive Agenten pro Raum möglich.`);
  }
}
