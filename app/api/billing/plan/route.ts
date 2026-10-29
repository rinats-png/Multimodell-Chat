import { NextResponse } from "next/server";
import { handleApi, jsonError } from "@/lib/api";
import { getSession, toPublicProfile } from "@/lib/session";
import { planSchema } from "@/lib/validation";

const CHECKOUT_URLS: Record<string, string | undefined> = {
  pro: process.env.NEXT_PUBLIC_CHECKOUT_URL_PRO,
  team: process.env.NEXT_PUBLIC_CHECKOUT_URL_TEAM,
};

/**
 * Tarifwechsel. Im Demo-Store sofort; in Produktion wird auf den Checkout
 * (z. B. Stripe Payment Link) weitergeleitet – der Tarif wird anschließend
 * serverseitig per Webhook mit Service-Role gesetzt.
 */
export async function POST(request: Request) {
  return handleApi(async () => {
    const { store } = await getSession();
    const { tier } = planSchema.parse(await request.json());

    if (store.setTier) {
      return NextResponse.json({ profile: toPublicProfile(await store.setTier(tier)) });
    }
    const checkoutUrl = CHECKOUT_URLS[tier];
    if (!checkoutUrl) return jsonError("Für diesen Tarif ist kein Checkout konfiguriert.", 501, "billing_not_configured");
    return NextResponse.json({ checkoutUrl });
  });
}
