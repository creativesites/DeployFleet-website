import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, createDecision, listDecisions, type CreateDecisionInput } from "@/lib/crm";
import type { DecisionStatus } from "@/lib/crmTypes";

/** Phase 1 §4.4/§7.4 — the Decision Ledger. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const decisions = await listDecisions({ status: (status as DecisionStatus) ?? undefined });
  return NextResponse.json({ ok: true, decisions });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: CreateDecisionInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.decisionText || !body.decisionText.trim() || !body.scope) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const decision = await createDecision(body);
  const relatedProspectId = body.scope.type === "prospect" ? body.scope.prospectId : null;
  const relatedEmployeeId = body.scope.type === "employee" ? body.scope.employeeId : null;

  await createAuditEvent({
    eventType: "decision_made",
    summary: decision.decisionText,
    relatedProspectId,
    relatedEmployeeId,
    actor: body.madeBy === "winston" ? "winston" : "ai_orchestrator",
    metadata: { decisionId: decision.id },
  });

  return NextResponse.json({ ok: true, decision });
}
