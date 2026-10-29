import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/ai/provider";
import { getSession, toPublicProfile } from "@/lib/session";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export const dynamic = "force-dynamic";

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { store, email, isDemoStore } = await getSession();
  const room = await store.getRoom(roomId);
  if (!room) notFound();

  const [agents, messages, rooms, profile] = await Promise.all([
    store.listAgents(room.id),
    store.listMessages(room.id),
    store.listRooms(),
    store.getProfile(),
  ]);

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
      isDemoModel={isDemoMode(profile.custom_openrouter_key)}
    />
  );
}
