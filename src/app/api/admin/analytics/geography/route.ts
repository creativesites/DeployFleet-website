import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getGeographyBreakdown } from "@/lib/visitorIntelligence";

/** Spec §16 — "since" is an ISO timestamp computed client-side from the Today/7d/30d/90d/All selector; omit for all-time. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const since = request.nextUrl.searchParams.get("since");
  const rows = await getGeographyBreakdown(since);

  return NextResponse.json({ ok: true, rows });
}
