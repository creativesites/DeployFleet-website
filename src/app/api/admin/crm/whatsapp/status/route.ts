import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { countWhatsAppSendsToday, DAILY_WHATSAPP_CAP } from "@/lib/crm";
import { getGatewayStatus, isGatewayConfigured } from "@/lib/whatsapp/gatewayClient";

// Polled every few seconds by WhatsAppConnectPanel while a connection is
// in progress — a cached response here means "still shows disconnected"
// forever after the real gateway state has already moved on, exactly
// the bug this was hit for on the demo server. `force-dynamic` plus an
// explicit no-store header closes both the Next.js Route Handler cache
// and any CDN/browser layer that might otherwise treat an identical GET
// URL as reusable.
export const dynamic = "force-dynamic";

/** Read by SendWhatsAppPanel / WhatsAppConnectPanel / the Prospect page's WhatsApp section before showing any action — the same "reflect server state, enforce nothing client-side" pattern as email/status. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const configured = isGatewayConfigured();
  const gateway = configured
    ? await getGatewayStatus()
    : { connected: false, phoneNumber: null, status: "idle" as const, qrDataUrl: null, linkCode: null };
  const sentToday = await countWhatsAppSendsToday();

  return NextResponse.json(
    { ok: true, configured, gateway, sentToday, cap: DAILY_WHATSAPP_CAP },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}
