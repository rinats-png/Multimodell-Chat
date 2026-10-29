import { NextResponse } from "next/server";
import { handleApi, HttpError, limitMutations } from "@/lib/api";
import { PLANS } from "@/lib/plans";
import { getSession } from "@/lib/session";

export async function GET() {
  return handleApi(async () => {
    const { store } = await getSession();
    return NextResponse.json({ rooms: await store.listRooms() });
  });
}

export async function POST() {
  return handleApi(async () => {
    const { store, userId } = await getSession();
    await limitMutations(userId);
    const [profile, rooms] = await Promise.all([store.getProfile(), store.listRooms()]);
    const { maxRooms } = PLANS[profile.subscription_tier].limits;
    if (rooms.length >= maxRooms) {
      throw new HttpError(402, "plan_limit", `Dein Tarif erlaubt bis zu ${maxRooms} Debatten. Lösche eine alte oder upgrade.`);
    }
    const room = await store.createRoom();
    return NextResponse.json({ room }, { status: 201 });
  });
}
