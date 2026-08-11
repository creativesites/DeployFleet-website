import { NextResponse, type NextRequest } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { recordHeartbeat } from "@/lib/visitorIntelligence";

interface RequestBody {
  sessionId?: string;
  visitorId?: string;
  activeSecondsDelta?: number;
}

/** A max-per-tick clamp — never trust the client to send an arbitrary "I was active for N hours" delta (spec §3's untrusted-browser principle applies to timing claims too, not just identity). */
const MAX_DELTA_SECONDS = 30;

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

  if (!body.sessionId || !body.visitorId || typeof body.activeSecondsDelta !== "number") {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const delta = Math.max(0, Math.min(MAX_DELTA_SECONDS, body.activeSecondsDelta));

  try {
    await recordHeartbeat(body.sessionId, body.visitorId, delta);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("analytics/session/heartbeat failed", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
