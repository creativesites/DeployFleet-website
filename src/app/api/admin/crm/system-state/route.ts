import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getSystemState } from "@/lib/ai/systemState";

/** Phase 2 §8.3/§8.4 — the Command Center's dashboard tiles read this directly, without going through the Orchestrator's chat/tool-calling path. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const state = await getSystemState();
  return NextResponse.json({ ok: true, state });
}
