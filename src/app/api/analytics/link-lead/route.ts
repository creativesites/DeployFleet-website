import { NextResponse, type NextRequest } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { linkVisitorToLead } from "@/lib/visitorIntelligence";

interface RequestBody {
  visitorId?: string;
  leadId?: string;
}

/** Spec §18/§38 — the one place an anonymous visitor becomes an identified one. Called from src/lib/analytics/client.ts's linkLead(), right after a lead form submission succeeds. */
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

  if (!body.visitorId || !body.leadId) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  try {
    await linkVisitorToLead(body.visitorId, body.leadId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("analytics/link-lead failed", error);
    return NextResponse.json({ ok: false, reason: "error" }, { status: 500 });
  }
}
