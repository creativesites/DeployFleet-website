import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { listAiEmployees } from "@/lib/crm";

/** Phase 1 §4.6/§7.3 — the AI Workforce list, read by both the Team page and a Prospect page's Employee Intelligence tab. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const employees = await listAiEmployees();
  return NextResponse.json({ ok: true, employees });
}
