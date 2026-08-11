import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { listProspects } from "@/lib/crm";
import type { PipelineStage, ProspectSource } from "@/lib/crmTypes";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const stageParam = params.get("stage");
  const dueBy = params.get("dueBy");
  const source = params.get("source");

  const prospects = await listProspects({
    stage: stageParam !== null ? (Number(stageParam) as PipelineStage) : undefined,
    source: source ? (source as ProspectSource) : undefined,
    dueBy: dueBy ?? undefined,
  });

  return NextResponse.json({ ok: true, prospects });
}
