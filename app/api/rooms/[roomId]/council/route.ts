import { NextResponse } from "next/server";
import { assertModelAllowed } from "@/lib/agent-policy";
import { handleApi, HttpError, limitMutations, notFound, parseParam, readJson } from "@/lib/api";
import { getCouncilPreset } from "@/lib/council-presets";
import { PLANS } from "@/lib/plans";
import { getSession } from "@/lib/session";
import { councilSchema, uuidSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ roomId: string }>;
}

/**
 * Setzt einen vorgefertigten Rat (Rollen, Modus, Starttext) in einer leeren Debatte ein. Ersetzt die bisherigen Agenten.
 * Nur in einer Debatte ohne Nachrichten, damit kein Verlauf seine Sprecher verliert. Tarifgrenzen: Im Starter sind nur
 * die ersten drei Rollen aktiv, die übrigen liegen bereit und lassen sich mit einem höheren Tarif einschalten.
 */
export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const roomId = parseParam((await params).roomId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    const room = await store.getRoom(roomId);
    if (!room) throw notFound();

    const { preset: presetId } = await readJson(request, councilSchema);
    const preset = getCouncilPreset(presetId);
    if (!preset) throw notFound();

    if ((await store.listMessages(roomId)).length > 0) {
      throw new HttpError(409, "room_not_empty", "Der Rat lässt sich nur in einer leeren Debatte wechseln. Starte dafür eine neue Debatte.");
    }

    const profile = await store.getProfile();
    for (const agent of preset.agents) assertModelAllowed(profile, agent.model_identifier);
    const { limits } = PLANS[profile.subscription_tier];

    for (const old of await store.listAgents(roomId)) await store.deleteAgent(old.id);
    for (const [index, agent] of preset.agents.entries()) {
      await store.createAgent({ ...agent, room_id: roomId, is_active: index < limits.maxActiveAgents, sort_order: index });
    }

    const active = Math.min(preset.agents.length, limits.maxActiveAgents);
    const updated = await store.updateRoom(roomId, {
      orchestration_mode: preset.mode,
      max_auto_turns: Math.max(1, Math.min(preset.turns, limits.maxAutoTurns, preset.mode === "round-robin" ? active : preset.turns)),
    });
    return NextResponse.json({ room: updated, agents: await store.listAgents(roomId), starter: preset.starter });
  });
}
