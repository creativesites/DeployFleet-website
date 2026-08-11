import { NextResponse, type NextRequest } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { identifyVisitor } from "@/lib/visitorIntelligence";
import { identifyFromFingerprintRequestId } from "@/lib/fingerprintServer";
import type { DeviceType, LocationSource } from "@/lib/visitorTypes";

/**
 * Spec §3 — the one place a Fingerprint requestId gets resolved into a
 * trusted identity, server-side, before anything is written. Called once
 * per SDK init from src/lib/analytics/client.ts's identify().
 */

interface RequestBody {
  requestId?: string | null;
  legacyVisitorId?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  language?: string | null;
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

  try {
    const requestId = typeof body.requestId === "string" ? body.requestId : null;
    const fp = requestId ? await identifyFromFingerprintRequestId(requestId) : null;

    const visitor = await identifyVisitor({
      fingerprintVisitorId: fp?.fingerprintVisitorId ?? null,
      confidenceScore: fp?.confidenceScore ?? null,
      isBot: fp?.isBot ?? false,
      isVpn: fp?.isVpn ?? false,
      isIncognito: fp?.isIncognito ?? false,
      isProxy: fp?.isProxy ?? false,
      deviceType: (fp?.deviceType ?? "unknown") as DeviceType,
      browser: fp?.browser ?? null,
      browserVersion: fp?.browserVersion ?? null,
      operatingSystem: fp?.operatingSystem ?? null,
      osVersion: fp?.osVersion ?? null,
      screenWidth: typeof body.screenWidth === "number" ? body.screenWidth : null,
      screenHeight: typeof body.screenHeight === "number" ? body.screenHeight : null,
      language: typeof body.language === "string" ? body.language.slice(0, 20) : null,
      country: fp?.country ?? null,
      countryCode: fp?.countryCode ?? null,
      region: fp?.region ?? null,
      city: fp?.city ?? null,
      timezone: fp?.timezone ?? null,
      locationSource: (fp?.locationSource ?? "unknown") as LocationSource,
      legacyVisitorId: typeof body.legacyVisitorId === "string" ? body.legacyVisitorId.slice(0, 100) : null,
    });

    return NextResponse.json({ ok: true, visitorId: visitor.id });
  } catch (error) {
    console.error("analytics/identify failed", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
