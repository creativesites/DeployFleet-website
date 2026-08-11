import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { backfillVisitorsFromPageviews } from "@/lib/visitorIntelligence";

/** Manually triggered from the admin Visitors tab — see task #84's write-up: idempotent, safe to run repeatedly, only ever processes pageview rows it hasn't already marked. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const result = await backfillVisitorsFromPageviews();
  return NextResponse.json({ ok: true, result });
}
