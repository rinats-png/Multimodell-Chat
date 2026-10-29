import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Öffnet die neueste Debatte oder legt die erste an. */
export default async function ChatIndex() {
  const { store } = await getSession();
  const rooms = await store.listRooms();
  const room = rooms[0] ?? (await store.createRoom("Meine erste KI-Debatte"));
  redirect(`/chat/${room.id}`);
}
