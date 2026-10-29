import { NextResponse } from "next/server";
import { handleApi, jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { agentCreateSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ roomId: string }>;
}

const MAX_AGENTS_FREE = 3;

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { roomId } = await params;
    const { store } = await getSession();
    if (!(await store.getRoom(roomId))) return jsonError("Raum nicht gefunden", 404, "not_found");

    const [profile, existing] = await Promise.all([store.getProfile(), store.listAgents(roomId)]);
    if (profile.subscription_tier === "free" && existing.length >= MAX_AGENTS_FREE) {
      return jsonError(`Im Starter-Tarif sind maximal ${MAX_AGENTS_FREE} Agenten pro Raum möglich.`, 402, "plan_limit");
    }

    const input = agentCreateSchema.parse(await request.json());
    const agent = await store.createAgent({
      ...input,
      room_id: roomId,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? existing.reduce((max, a) => Math.max(max, a.sort_order + 1), 0),
    });
    return NextResponse.json({ agent }, { status: 201 });
  });
}
