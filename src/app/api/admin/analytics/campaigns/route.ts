import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getCampaignPerformance, getFunnelSummary } from "@/lib/visitorIntelligence";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const [rows, funnel] = await Promise.all([getCampaignPerformance(), getFunnelSummary()]);
  return NextResponse.json({ ok: true, rows, funnel });
}
