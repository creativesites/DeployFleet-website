import { NextResponse, type NextRequest } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getOrStartSession, getVisitor } from "@/lib/visitorIntelligence";
import { EMPTY_UTM, type DeviceType, type UtmParams } from "@/lib/visitorTypes";

interface RequestBody {
  visitorId?: string;
  clientSessionId?: string | null;
  landingPage?: string;
  referrer?: string | null;
  utm?: Partial<UtmParams>;
  deviceType?: DeviceType;
}

function sanitizeUtm(raw: Partial<UtmParams> | undefined): UtmParams {
  if (!raw || typeof raw !== "object") return EMPTY_UTM;
  const clean = (v: unknown): string | null => (typeof v === "string" && v.length <= 300 ? v : null);
  return {
    utmSource: clean(raw.utmSource),
    utmMedium: clean(raw.utmMedium),
    utmCampaign: clean(raw.utmCampaign),
    utmTerm: clean(raw.utmTerm),
    utmContent: clean(raw.utmContent),
    gclid: clean(raw.gclid),
    fbclid: clean(raw.fbclid),
    liFatId: clean(raw.liFatId),
    msclkid: clean(raw.msclkid),
  };
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

  if (!body.visitorId || typeof body.visitorId !== "string" || !body.landingPage) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  try {
    // Session-level device/geo is filled from the visitor doc rather than
    // trusted client input — the trusted values already resolved once at
    // identify() time via the Fingerprint Server API (or left null when
    // Fingerprint isn't configured, in which case the client's own
    // best-effort deviceType guess is the only signal available).
    const visitor = await getVisitor(body.visitorId);
    const session = await getOrStartSession(body.visitorId, body.clientSessionId ?? null, {
      landingPage: body.landingPage.slice(0, 500),
      referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
      utm: sanitizeUtm(body.utm),
      deviceType: visitor?.deviceType && visitor.deviceType !== "unknown" ? visitor.deviceType : (body.deviceType ?? "unknown"),
      browser: visitor?.browser ?? null,
      operatingSystem: visitor?.operatingSystem ?? null,
      country: visitor?.country ?? null,
      region: visitor?.region ?? null,
      city: visitor?.city ?? null,
    });

    return NextResponse.json({ ok: true, sessionId: session.id });
  } catch (error) {
    console.error("analytics/session/start failed", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
