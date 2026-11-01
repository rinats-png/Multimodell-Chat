import { notFound } from "next/navigation";
import { isLocalSubscriptionMode } from "@/lib/ai/local-cli";
import { hasUniversalOwnAccess, resolveApiKey } from "@/lib/ai/provider";
import { ABO_MODEL_LIST, MODEL_CATALOG } from "@/lib/models";
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
  const publicProfile = toPublicProfile(profile);
  const localMode = isLocalSubscriptionMode();
  const catalog = [...(localMode ? ABO_MODEL_LIST : []), ...MODEL_CATALOG];

  return (
    <ChatWorkspace
      key={room.id}
      initialRoom={room}
      initialAgents={agents}
      initialMessages={messages}
      initialProfile={publicProfile}
      rooms={rooms}
      email={email}
      isDemoStore={isDemoStore}
      isDemoModel={key.source === "demo" && publicProfile.connections.length === 0 && !localMode}
      limits={PLANS[profile.subscription_tier].limits}
      modelCatalog={catalog.map((m) => ({ id: m.id, label: m.label }))}
      freeModelChoice={hasUniversalOwnAccess(profile)}
    />
  );
}
