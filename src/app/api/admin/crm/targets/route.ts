import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getWeeklyScoreboard } from "@/lib/crm";

/** Phase 0 §6.2's Weekly Targets scoreboard. weekStart defaults to the most recent Monday (UTC). */
function mostRecentMondayIso(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const weekStart = request.nextUrl.searchParams.get("weekStart") ?? mostRecentMondayIso();
  const scoreboard = await getWeeklyScoreboard(weekStart);
  return NextResponse.json({ ok: true, scoreboard });
}
