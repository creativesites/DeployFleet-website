import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import {
  countWhatsAppSendsToday,
  createAuditEvent,
  createWhatsAppMessage,
  createWhatsAppSend,
  DAILY_WHATSAPP_CAP,
  getLastWhatsAppSendForProspect,
  getOrCreateConversation,
  getProspect,
  logInteraction,
  updateWhatsAppConversation,
  WHATSAPP_COOLDOWN_HOURS,
} from "@/lib/crm";
import { isGatewayConfigured, sendText } from "@/lib/whatsapp/gatewayClient";

interface RequestBody {
  prospectId?: string;
  message?: string;
}

/**
 * §8/§11/§14 WA-3 — the one route that actually sends outbound WhatsApp.
 * Every send here is Level 0: this route is only ever called after
 * Winston has explicitly clicked Send in SendWhatsAppPanel on a message
 * he's already seen (and could edit) — there is no path from the
 * Orchestrator or any AI feature that reaches this route without that
 * click, matching §8's permanent floor for the first outbound message
 * (and, in this build's scope, every message — Supervised/Autonomous
 * modes are explicitly out of scope). Cap → cooldown → opt-out → gateway
 * call → log, all in one request, mirroring email/send's own discipline.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }
  if (!isGatewayConfigured()) {
    return NextResponse.json({ ok: false, reason: "gateway_not_configured" });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }
  if (!body.prospectId || !body.message?.trim()) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const prospect = await getProspect(body.prospectId);
  if (!prospect) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (prospect.whatsappOptedOut) {
    return NextResponse.json({ ok: false, reason: "opted_out" });
  }
  if (prospect.whatsappStatus !== "verified" || !prospect.whatsappJid) {
    return NextResponse.json({ ok: false, reason: "not_verified" });
  }

  const sentToday = await countWhatsAppSendsToday();
  if (sentToday >= DAILY_WHATSAPP_CAP) {
    return NextResponse.json({ ok: false, reason: "daily_cap_reached", sentToday, cap: DAILY_WHATSAPP_CAP });
  }

  const lastSend = await getLastWhatsAppSendForProspect(body.prospectId);
  const isFirstOutreach = lastSend === null;
  if (lastSend) {
    const hoursSince = (Date.now() - new Date(lastSend.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < WHATSAPP_COOLDOWN_HOURS) {
      return NextResponse.json({ ok: false, reason: "cooldown_active", hoursRemaining: Math.ceil(WHATSAPP_COOLDOWN_HOURS - hoursSince) });
    }
  }

  const conversation = await getOrCreateConversation(prospect.id, prospect.whatsappJid);
  const messageBody = body.message.trim();
  const result = await sendText(prospect.whatsappJid, messageBody);

  const send = await createWhatsAppSend({
    prospectId: prospect.id,
    conversationId: conversation.id,
    recipientJid: prospect.whatsappJid,
    messageBody,
    isFirstOutreach,
    status: result.ok ? "sent" : "failed",
    errorMessage: result.reason ?? null,
  });

  if (result.ok) {
    const nowIso = new Date().toISOString();
    await createWhatsAppMessage({
      conversationId: conversation.id,
      waMessageId: result.waMessageId ?? send.id,
      senderType: "winston",
      body: messageBody,
      whatsappTimestamp: nowIso,
    });
    await updateWhatsAppConversation(
      conversation.id,
      { state: "outreach_sent", lastMessageAt: nowIso, lastMessagePreview: messageBody.slice(0, 160), requiresResponse: false },
      "Winston sent an outbound WhatsApp message."
    );
    await logInteraction(prospect.id, { type: "whatsapp", outcome: null, rawNote: messageBody, createdBy: "Winston" });
    await createAuditEvent({
      eventType: "whatsapp_sent",
      summary: `Sent WhatsApp message to ${prospect.name}`,
      relatedProspectId: prospect.id,
      actor: "winston",
      metadata: { whatsappSendId: send.id, isFirstOutreach },
    });
  }

  return NextResponse.json({
    ok: result.ok,
    reason: result.ok ? undefined : "send_failed",
    detail: result.ok ? undefined : result.reason,
    sentToday: sentToday + (result.ok ? 1 : 0),
    cap: DAILY_WHATSAPP_CAP,
  });
}
