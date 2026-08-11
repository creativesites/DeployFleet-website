import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, supersedeDecision, type CreateDecisionInput } from "@/lib/crm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: CreateDecisionInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.decisionText || !body.decisionText.trim() || !body.scope) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const decision = await supersedeDecision(id, body);
  const relatedProspectId = body.scope.type === "prospect" ? body.scope.prospectId : null;
  const relatedEmployeeId = body.scope.type === "employee" ? body.scope.employeeId : null;

  await createAuditEvent({
    eventType: "decision_superseded",
    summary: `Superseded a decision with: ${decision.decisionText}`,
    relatedProspectId,
    relatedEmployeeId,
    actor: body.madeBy === "winston" ? "winston" : "ai_orchestrator",
    metadata: { oldDecisionId: id, newDecisionId: decision.id },
  });

  return NextResponse.json({ ok: true, decision });
}
