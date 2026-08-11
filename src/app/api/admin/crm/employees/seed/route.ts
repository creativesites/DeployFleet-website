import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { seedAiEmployees } from "@/lib/crm";

/** §7.3 — one-time seed for the 5 starter AI Workforce personas, idempotent by name (same shape as /api/admin/crm/sync's seedProspectsFromCsv). */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const result = await seedAiEmployees();
  return NextResponse.json({ ok: true, ...result });
}
