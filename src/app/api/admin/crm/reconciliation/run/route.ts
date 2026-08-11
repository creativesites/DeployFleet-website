import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { runReconciliation } from "@/lib/crm/reconciliation";

/** §7.5's manual trigger — a button on /admin/insights, not a background job (see the architecture doc §12 on why Vercel Cron is deliberately deferred). */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const result = await runReconciliation();
  return NextResponse.json({ ok: true, ...result });
}
