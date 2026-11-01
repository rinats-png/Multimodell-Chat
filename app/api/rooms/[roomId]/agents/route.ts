import { NextResponse } from "next/server";
import { assertActiveAgentLimit, assertModelAllowed } from "@/lib/agent-policy";
import { handleApi, HttpError, limitMutations, notFound, parseParam, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { agentCreateSchema, uuidSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ roomId: string }>;
}

const MAX_AGENTS_PER_ROOM = 12;

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const roomId = parseParam((await params).roomId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    if (!(await store.getRoom(roomId))) throw notFound();

    const input = await readJson(request, agentCreateSchema);
    const [profile, existing] = await Promise.all([store.getProfile(), store.listAgents(roomId)]);
    if (existing.length >= MAX_AGENTS_PER_ROOM) throw new HttpError(400, "too_many_agents", `Höchstens ${MAX_AGENTS_PER_ROOM} Agenten pro Raum.`);
    assertModelAllowed(profile, input.model_identifier);
    const isActive = input.is_active ?? true;
    assertActiveAgentLimit(profile, existing, isActive);

    const agent = await store.createAgent({
      ...input,
      room_id: roomId,
      is_active: isActive,
      sort_order: input.sort_order ?? existing.reduce((max, a) => Math.max(max, a.sort_order + 1), 0),
    });
    return NextResponse.json({ agent }, { status: 201 });
  });
}
