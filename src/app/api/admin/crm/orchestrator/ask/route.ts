import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { runOrchestratorTurn } from "@/lib/ai/orchestrator";

/** Phase 2 §8.1/§8.4 — the Command Center's "what should I do right now?" prompt box calls this directly. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }
  if (process.env.AI_FEATURES_ENABLED === "false") {
    return NextResponse.json({ ok: false, reason: "ai_disabled" });
  }

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.prompt || !body.prompt.trim()) {
    return NextResponse.json({ ok: false, reason: "prompt_required" }, { status: 400 });
  }

  const result = await runOrchestratorTurn(body.prompt.trim());
  return NextResponse.json(result);
}
