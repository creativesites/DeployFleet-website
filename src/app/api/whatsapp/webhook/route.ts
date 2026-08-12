import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import {
  createAuditEvent,
  createWhatsAppMessage,
  createWhatsAppMessageAnalysis,
  findProspectByPhone,
  getOrCreateConversation,
  getProspect,
  updateProspect,
  updateWhatsAppConversation,
} from "@/lib/crm";
import { runInboxExtraction } from "@/lib/ai/inboxExtraction";
import { compileProspectContext } from "@/lib/ai/contextCompiler";
import { completeWithFallback } from "@/lib/ai/router";
import { WHATSAPP_ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseJsonLoosely } from "@/lib/ai/jsonExtract";
import type { BuyingSignalType, ConversationState, WhatsAppEntity } from "@/lib/crmTypes";

/**
 * §3/§7/§14 WA-2 — the one route the WhatsApp gateway service (WA-0)
 * calls whenever a message arrives on the connected number. NOT gated by
 * requireAdmin() (there's no browser session here — the gateway is a
 * separate service, not a signed-in Clerk user) — gated instead by a
 * shared-secret bearer token, the same WHATSAPP_GATEWAY_SECRET both
 * directions of this integration use (gatewayClient.ts sends it outbound
 * to the gateway; this route checks it inbound from the gateway).
 */

interface WebhookBody {
  jid?: string;
  phone?: string;
  waMessageId?: string;
  body?: string | null;
  timestampMs?: number;
  fromMe?: boolean;
}

interface RawAnalysis {
  sentiment?: "positive" | "negative" | "neutral" | "mixed";
  intentCategory?: string;
  intentConfidence?: number;
  entities?: WhatsAppEntity[];
  buyingSignals?: BuyingSignalType[];
  requiresResponse?: boolean;
  responseUrgency?: "low" | "medium" | "high" | "urgent";
  summary?: string;
  suggestedConversationState?: ConversationState | null;
}

/** §10 — no opt-in gate; every genuinely detected signal moves the score, up to 100. */
function scoreBump(signals: BuyingSignalType[]): number {
  return Math.min(100, signals.length * 15);
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.WHATSAPP_GATEWAY_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: WebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }
  if (!body.jid || !body.phone || !body.waMessageId) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const match = await findProspectByPhone(body.phone);
  if (!match) {
    // §7 — an unrecognized number is logged for visibility but never
    // silently turned into a new Prospect; out of scope for this build.
    return NextResponse.json({ ok: true, matched: false });
  }

  const prospect = await getProspect(match.prospectId);
  if (!prospect) return NextResponse.json({ ok: true, matched: false });

  const conversation = await getOrCreateConversation(prospect.id, body.jid, match.prospectContactId);
  const timestampIso = body.timestampMs ? new Date(body.timestampMs).toISOString() : new Date().toISOString();

  const message = await createWhatsAppMessage({
    conversationId: conversation.id,
    waMessageId: body.waMessageId,
    senderType: body.fromMe ? "winston" : "prospect",
    body: body.body ?? null,
    whatsappTimestamp: timestampIso,
  });

  if (body.fromMe || !body.body?.trim()) {
    await updateWhatsAppConversation(conversation.id, { lastMessageAt: timestampIso, lastMessagePreview: (body.body ?? "").slice(0, 160) });
    return NextResponse.json({ ok: true, matched: true, messageId: message.id });
  }

  await createAuditEvent({
    eventType: "whatsapp_message_received",
    summary: `WhatsApp message received from ${prospect.name}`,
    relatedProspectId: prospect.id,
    actor: "ai_inbox_extraction",
    metadata: { conversationId: conversation.id, messageId: message.id },
  });

  if (process.env.AI_FEATURES_ENABLED === "false") {
    await updateWhatsAppConversation(conversation.id, {
      lastMessageAt: timestampIso,
      lastMessagePreview: body.body.slice(0, 160),
      requiresResponse: true,
      unreadCount: conversation.unreadCount + 1,
    });
    return NextResponse.json({ ok: true, matched: true, messageId: message.id, analyzed: false });
  }

  const context = await compileProspectContext(prospect.id);
  const userPrompt = `Known context:\n${context}\n\nInbound WhatsApp message:\n${body.body}`;
  const analysisResult = await completeWithFallback({ systemPrompt: WHATSAPP_ANALYSIS_SYSTEM_PROMPT, userPrompt });
  const raw = analysisResult.ok ? parseJsonLoosely<RawAnalysis>(analysisResult.text) : null;

  if (raw) {
    await createWhatsAppMessageAnalysis({
      messageId: message.id,
      sentiment: raw.sentiment ?? "neutral",
      intentCategory: raw.intentCategory ?? "unknown",
      intentConfidence: raw.intentConfidence ?? 0,
      entities: raw.entities ?? [],
      buyingSignals: raw.buyingSignals ?? [],
      requiresResponse: raw.requiresResponse ?? true,
      responseUrgency: raw.responseUrgency ?? "medium",
      summary: raw.summary ?? "",
      suggestedConversationState: raw.suggestedConversationState ?? null,
    });

    await updateWhatsAppConversation(
      conversation.id,
      {
        state: raw.suggestedConversationState ?? "responded",
        lastMessageAt: timestampIso,
        lastMessagePreview: body.body.slice(0, 160),
        requiresResponse: raw.requiresResponse ?? true,
        responseUrgency: raw.responseUrgency ?? "medium",
        unreadCount: raw.requiresResponse === false ? 0 : conversation.unreadCount + 1,
      },
      raw.summary
    );

    if (raw.buyingSignals && raw.buyingSignals.length > 0) {
      const bump = scoreBump(raw.buyingSignals);
      const nextScore = Math.max(prospect.opportunityScore ?? 0, bump);
      if (nextScore !== prospect.opportunityScore) {
        await updateProspect(prospect.id, { opportunityScore: nextScore });
      }
    }
  } else {
    await updateWhatsAppConversation(conversation.id, {
      lastMessageAt: timestampIso,
      lastMessagePreview: body.body.slice(0, 160),
      requiresResponse: true,
      unreadCount: conversation.unreadCount + 1,
    });
  }

  // §7 — facts/tasks/decisions extraction stays on the exact same
  // human-approved Inbox path as every other source; this never writes
  // one itself.
  await runInboxExtraction({
    rawText: body.body,
    sourceType: "whatsapp_conversation",
    relatedProspectId: prospect.id,
  });

  return NextResponse.json({ ok: true, matched: true, messageId: message.id, analyzed: Boolean(raw) });
}
