import { NextResponse } from "next/server";
import { assertActiveAgentLimit, assertModelAllowed } from "@/lib/agent-policy";
import { handleApi, limitMutations, notFound, parseParam, readJson } from "@/lib/api";
import { getSession } from "@/lib/session";
import { agentPatchSchema, uuidSchema } from "@/lib/validation";

interface Params {
  params: Promise<{ agentId: string }>;
}

// Zugriffsschutz: Supabase-RLS liefert nur Agenten in eigenen Räumen; fremde IDs → 404.
export async function PATCH(request: Request, { params }: Params) {
  return handleApi(async () => {
    const agentId = parseParam((await params).agentId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    const patch = await readJson(request, agentPatchSchema);
    const profile = await store.getProfile();
    assertModelAllowed(profile, patch.model_identifier);

    const current = await store.getAgent(agentId);
    if (!current) throw notFound();
    if (patch.is_active === true && !current.is_active) {
      assertActiveAgentLimit(profile, await store.listAgents(current.room_id), true);
    }
    const agent = await store.updateAgent(agentId, patch);
    if (!agent) throw notFound();
    return NextResponse.json({ agent });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handleApi(async () => {
    const agentId = parseParam((await params).agentId, uuidSchema);
    const { store, userId } = await getSession();
    await limitMutations(userId);
    if (!(await store.deleteAgent(agentId))) throw notFound();
    return new Response(null, { status: 204 });
  });
}
