import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { listAuditEvents } from "@/lib/crm";

/** Phase 2 §8.5 — the system-wide activity feed, reading AuditEvent chronologically. Every prior phase already writes to this collection. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const events = await listAuditEvents({
    relatedProspectId: params.get("relatedProspectId") ?? undefined,
    relatedEmployeeId: params.get("relatedEmployeeId") ?? undefined,
    limit: 500,
  });
  return NextResponse.json({ ok: true, events });
}
