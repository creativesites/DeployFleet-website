import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { listVisitors } from "@/lib/visitorIntelligence";
import type { Visitor } from "@/lib/visitorTypes";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const minIntentScore = params.get("minIntentScore");

  const visitors = await listVisitors({
    status: status === "identified" || status === "anonymous" ? status : undefined,
    minIntentScore: minIntentScore ? Number(minIntentScore) : undefined,
  });

  return NextResponse.json({ ok: true, visitors: visitors satisfies Visitor[] });
}
