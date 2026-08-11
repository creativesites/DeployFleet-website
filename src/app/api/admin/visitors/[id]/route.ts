import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getVisitor, getVisitorTimeline, listSessionsForVisitor } from "@/lib/visitorIntelligence";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const visitor = await getVisitor(id);
  if (!visitor) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  const [sessions, timeline] = await Promise.all([listSessionsForVisitor(id), getVisitorTimeline(id)]);

  return NextResponse.json({ ok: true, visitor, sessions, timeline });
}
