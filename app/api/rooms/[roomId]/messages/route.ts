import { handleApi, limitMutations, notFound, parseParam } from "@/lib/api";
import { getSession } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ roomId: string }>;
}

/** Verlauf leeren (der Token-Verbrauch im Profil bleibt erhalten). */
export async function DELETE(_request: Request, { params }: Params) {
  return handleApi(async () => {
    const roomId = parseParam((await params).roomId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    if (!(await store.getRoom(roomId))) throw notFound();
    await store.clearMessages(roomId);
    return new Response(null, { status: 204 });
  });
}
