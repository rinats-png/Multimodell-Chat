import { handleApi, limitMutations, notFound, parseParam } from "@/lib/api";
import { getSession } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ reportId: string }>;
}

/** Löscht einen eigenen Bericht samt Freigabe-Link. Fremde IDs verhalten sich wie „nicht vorhanden“. */
export async function DELETE(_request: Request, { params }: Params) {
  return handleApi(async () => {
    const reportId = parseParam((await params).reportId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    if (!(await store.deleteReport(reportId))) throw notFound();
    return new Response(null, { status: 204 });
  });
}
