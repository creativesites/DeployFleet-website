import { NextResponse, type NextRequest } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { recordEvent } from "@/lib/visitorIntelligence";
import type { EventType } from "@/lib/visitorTypes";

const VALID_EVENT_TYPES = new Set<EventType>([
  "page_view",
  "page_exit",
  "session_start",
  "session_end",
  "scroll",
  "engaged_view",
  "click",
  "cta_click",
  "form_start",
  "form_field_focus",
  "form_submit",
  "form_success",
  "form_error",
  "phone_click",
  "email_click",
  "whatsapp_click",
  "demo_request",
  "contact_request",
  "pricing_view",
  "pricing_interaction",
  "calculator_start",
  "calculator_complete",
  "download",
  "outbound_link_click",
  "video_start",
  "video_progress",
  "video_complete",
  "search",
  "faq_open",
  "navigation_click",
  "error",
]);

/** Spec §29 — metadata is meant for small structured facts ({ depth: 75 }, { cta: "request_demo" }), never arbitrary form contents. This is a size backstop, not a content filter — the actual "never log sensitive values" discipline lives in the call sites that build trackEvent() payloads (spec §10). */
const MAX_METADATA_BYTES = 4000;

interface RequestBody {
  visitorId?: string;
  sessionId?: string;
  eventType?: string;
  eventName?: string | null;
  pagePath?: string | null;
  pageTitle?: string | null;
  pageUrl?: string | null;
  elementId?: string | null;
  elementText?: string | null;
  elementType?: string | null;
  metadata?: Record<string, unknown> | null;
}

function clean(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length <= maxLength ? value : null;
}

export async function POST(request: NextRequest) {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "not_configured" });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.visitorId || !body.sessionId || !body.eventType || !VALID_EVENT_TYPES.has(body.eventType as EventType)) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  let metadata: Record<string, unknown> | null = null;
  if (body.metadata && typeof body.metadata === "object") {
    const serialized = JSON.stringify(body.metadata);
    if (serialized.length <= MAX_METADATA_BYTES) metadata = body.metadata;
  }

  try {
    await recordEvent({
      visitorId: body.visitorId,
      sessionId: body.sessionId,
      eventType: body.eventType as EventType,
      eventName: clean(body.eventName, 200),
      pagePath: clean(body.pagePath, 500),
      pageTitle: clean(body.pageTitle, 300),
      pageUrl: clean(body.pageUrl, 1000),
      elementId: clean(body.elementId, 200),
      elementText: clean(body.elementText, 300),
      elementType: clean(body.elementType, 100),
      metadata,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("analytics/events failed", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
