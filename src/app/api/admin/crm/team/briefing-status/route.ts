import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getBriefingStatus } from "@/lib/crm";

/** Revenue OS RS-2 §5.3–5.4 — per-worker daily/weekly submission completeness. Informational only; never gates any page. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const report = await getBriefingStatus();
  return NextResponse.json({ ok: true, report });
}
