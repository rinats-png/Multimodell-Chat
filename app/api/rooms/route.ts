import { NextResponse } from "next/server";
import { handleApi } from "@/lib/api";
import { getSession } from "@/lib/session";

export async function GET() {
  return handleApi(async () => {
    const { store } = await getSession();
    return NextResponse.json({ rooms: await store.listRooms() });
  });
}

export async function POST() {
  return handleApi(async () => {
    const { store } = await getSession();
    const room = await store.createRoom();
    return NextResponse.json({ room }, { status: 201 });
  });
}
