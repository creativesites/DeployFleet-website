import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { connectGateway, isGatewayConfigured } from "@/lib/whatsapp/gatewayClient";

interface RequestBody {
  phone?: string;
  forceNewQR?: boolean;
}

/**
 * The admin dashboard's own "Connect WhatsApp" button
 * (WhatsAppInboxTab.tsx) — the one path from the Next.js app that
 * actually starts a session on the gateway. Always an explicit human
 * click, never automatic. Omit `phone` in the body for the QR flow;
 * pass digits-only for the pairing-code flow. This route holds
 * WHATSAPP_GATEWAY_SECRET server-side and calls the gateway on the
 * admin's behalf — the browser never sees that secret.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isGatewayConfigured()) {
    return NextResponse.json({ ok: false, reason: "gateway_not_configured" });
  }

  let body: RequestBody = {};
  try {
    body = await request.json();
  } catch {
    // an empty body (the QR flow) is valid — invalid JSON just means "no options given"
  }

  const result = await connectGateway({ phone: body.phone, forceNewQR: body.forceNewQR });
  return NextResponse.json(result);
}
