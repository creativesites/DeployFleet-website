import { NextResponse, type NextRequest } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { endSession } from "@/lib/visitorIntelligence";

interface RequestBody {
  sessionId?: string;
  visitorId?: string;
  exitPage?: string | null;
  durationSeconds?: number;
}

const MAX_DURATION_SECONDS = 24 * 60 * 60;

/** Delivered via navigator.sendBeacon (see client.ts's sendBeaconJson) — the request body still parses as ordinary JSON, but the response is never read by the browser, so this must never depend on returning anything meaningful. */
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

  if (!body.sessionId || !body.visitorId || typeof body.durationSeconds !== "number") {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  try {
    await endSession(body.sessionId, body.visitorId, {
      exitPage: typeof body.exitPage === "string" ? body.exitPage.slice(0, 500) : null,
      durationSeconds: Math.max(0, Math.min(MAX_DURATION_SECONDS, body.durationSeconds)),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("analytics/session/end failed", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
