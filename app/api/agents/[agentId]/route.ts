import { NextResponse } from "next/server";
import { handleApi } from "@/lib/api";
import { getSession } from "@/lib/session";
import { agentPatchSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ agentId: string }>;
}

// Zugriffsschutz: Supabase-RLS erlaubt nur Agenten in eigenen Räumen.
export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { agentId } = await params;
    const { store } = await getSession();
    const patch = agentPatchSchema.parse(await request.json());
    return NextResponse.json({ agent: await store.updateAgent(agentId, patch) });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handleApi(async () => {
    const { agentId } = await params;
    const { store } = await getSession();
    await store.deleteAgent(agentId);
    return new Response(null, { status: 204 });
  });
}
