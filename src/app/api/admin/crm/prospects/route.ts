import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createProspect, listProspects, type CreateProspectInput } from "@/lib/crm";
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
  const campaignId = params.get("campaignId");

  const prospects = await listProspects({
    stage: stageParam !== null ? (Number(stageParam) as PipelineStage) : undefined,
    source: source ? (source as ProspectSource) : undefined,
    dueBy: dueBy ?? undefined,
    campaignId: campaignId ?? undefined,
  });

  return NextResponse.json({ ok: true, prospects });
}

/** Phase 0 §6.5's manual add-prospect form — the fourth prospect-creation path alongside seedProspectsFromCsv/syncLeadsToProspects, tagged flags:["manual-entry"] in crm.ts. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: CreateProspectInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ ok: false, reason: "name_required" }, { status: 400 });
  }

  const prospect = await createProspect(body);
  return NextResponse.json({ ok: true, prospect });
}
