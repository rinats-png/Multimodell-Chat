import { NextResponse } from "next/server";
import { handleApi, jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";
import { roomPatchSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ roomId: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { roomId } = await params;
    const { store } = await getSession();
    if (!(await store.getRoom(roomId))) return jsonError("Raum nicht gefunden", 404, "not_found");
    const patch = roomPatchSchema.parse(await request.json());
    return NextResponse.json({ room: await store.updateRoom(roomId, patch) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handleApi(async () => {
    const { roomId } = await params;
    const { store } = await getSession();
    if (!(await store.getRoom(roomId))) return jsonError("Raum nicht gefunden", 404, "not_found");
    await store.deleteRoom(roomId);
    return new Response(null, { status: 204 });
  });
}
