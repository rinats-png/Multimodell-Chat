import { handleApi, jsonError } from "@/lib/api";
import { getSession } from "@/lib/session";

interface Params {
  params: Promise<{ roomId: string }>;
}

/** Verlauf leeren (Ledger-Verbrauch bleibt im Profil erhalten). */
export async function DELETE(_request: Request, { params }: Params) {
  return handleApi(async () => {
    const { roomId } = await params;
    const { store } = await getSession();
    if (!(await store.getRoom(roomId))) return jsonError("Raum nicht gefunden", 404, "not_found");
    await store.clearMessages(roomId);
    return new Response(null, { status: 204 });
  });
}
