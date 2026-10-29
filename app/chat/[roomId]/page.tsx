import { notFound } from "next/navigation";
import { resolveApiKey } from "@/lib/ai/provider";
import { MODEL_CATALOG } from "@/lib/models";
import { PLANS } from "@/lib/plans";
import { getSession, toPublicProfile } from "@/lib/session";
import { uuidSchema } from "@/lib/validation";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const roomId = uuidSchema.safeParse((await params).roomId);
  if (!roomId.success) notFound();
  const { store, email, isDemoStore, allowPlatformKey } = await getSession();
  const room = await store.getRoom(roomId.data);
  if (!room) notFound();

  const [agents, messages, rooms, profile] = await Promise.all([
    store.listAgents(room.id),
    store.listMessages(room.id),
    store.listRooms(),
    store.getProfile(),
  ]);
  const key = resolveApiKey(profile, { allowPlatformKey });

  return (
    <ChatWorkspace
      key={room.id}
      initialRoom={room}
      initialAgents={agents}
      initialMessages={messages}
      initialProfile={toPublicProfile(profile)}
      rooms={rooms}
      email={email}
      isDemoStore={isDemoStore}
      isDemoModel={key.source === "demo"}
      limits={PLANS[profile.subscription_tier].limits}
      modelCatalog={MODEL_CATALOG.map((m) => ({ id: m.id, label: m.label }))}
      freeModelChoice={key.source === "byok"}
    />
  );
}
