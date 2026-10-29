import { NextResponse } from "next/server";
import { handleApi, HttpError, limitMutations, notFound, parseParam, readJson } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { getSession } from "@/lib/session";
import { roomPatchSchema, uuidSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const roomId = parseParam((await params).roomId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    if (!(await store.getRoom(roomId))) throw notFound();
    const patch = await readJson(request, roomPatchSchema);

    const { limits, name } = PLANS[(await store.getProfile()).subscription_tier];
    if (patch.max_auto_turns !== undefined && patch.max_auto_turns > limits.maxAutoTurns) {
      throw new HttpError(402, "plan_limit", `Im Tarif ${name} sind höchstens ${limits.maxAutoTurns} Auto-Turns möglich.`);
    }
    if (patch.sliding_window_size !== undefined && patch.sliding_window_size > limits.maxSlidingWindow) {
      throw new HttpError(402, "plan_limit", `Im Tarif ${name} ist das Sliding Window auf ${limits.maxSlidingWindow} Nachrichten begrenzt.`);
    }
    return NextResponse.json({ room: await store.updateRoom(roomId, patch) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handleApi(async () => {
    const roomId = parseParam((await params).roomId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    if (!(await store.getRoom(roomId))) throw notFound();
    await store.deleteRoom(roomId);
    return new Response(null, { status: 204 });
  });
}
