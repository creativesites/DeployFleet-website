import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { countWhatsAppSendsToday, DAILY_WHATSAPP_CAP } from "@/lib/crm";
import { getGatewayStatus, isGatewayConfigured } from "@/lib/whatsapp/gatewayClient";

/** Read by SendWhatsAppPanel / the Prospect page's WhatsApp section before showing any action — the same "reflect server state, enforce nothing client-side" pattern as email/status. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const configured = isGatewayConfigured();
  const gateway = configured ? await getGatewayStatus() : { connected: false, phoneNumber: null, status: "idle" as const };
  const sentToday = await countWhatsAppSendsToday();

  return NextResponse.json({ ok: true, configured, gateway, sentToday, cap: DAILY_WHATSAPP_CAP });
}
