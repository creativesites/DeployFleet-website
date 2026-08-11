import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, createDecision, createFact, createTask, getInboxEntry, markInboxEntryReviewed } from "@/lib/crm";
import { INBOX_SOURCE_TYPE_LABEL, type DecisionScope } from "@/lib/crmTypes";

interface ApprovedFact {
  index: number;
  prospectId: string;
}

interface ApprovedTask {
  index: number;
  prospectId?: string | null;
}

interface ApprovedDecision {
  index: number;
}

interface RequestBody {
  facts?: ApprovedFact[];
  tasks?: ApprovedTask[];
  decisions?: ApprovedDecision[];
}

/**
 * §7.1 step 4-5 — "review, not silent apply." This is the only route
 * that turns an Inbox extraction proposal into real writes, one approved
 * item at a time; every write carries sourceInboxEntryId/an AuditEvent
 * for the provenance chain the brief calls for. A fact with no resolved
 * prospectId is silently skipped (Fact.prospectId is required) — the
 * review UI is responsible for only submitting facts it has a confirmed
 * prospect match for.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const entry = await getInboxEntry(id);
  if (!entry || !entry.extractionResult) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const sourceLabel = `AI Inbox (${INBOX_SOURCE_TYPE_LABEL[entry.sourceType]}), ${new Date(entry.createdAt).toLocaleDateString()}`;

  const createdFacts: string[] = [];
  for (const item of body.facts ?? []) {
    const extracted = entry.extractionResult.facts[item.index];
    if (!extracted || !item.prospectId) continue;
    const fact = await createFact({
      prospectId: item.prospectId,
      factType: "other",
      key: extracted.key,
      value: extracted.value,
      source: sourceLabel,
      sourceType: "ai_research",
      confidence: extracted.confidence,
    });
    createdFacts.push(fact.id);
    await createAuditEvent({
      eventType: "fact_created",
      summary: `Extracted fact "${extracted.key}" from the Inbox`,
      relatedProspectId: item.prospectId,
      actor: "ai_inbox_extraction",
      metadata: { factId: fact.id, sourceInboxEntryId: id },
    });
  }

  const createdTasks: string[] = [];
  for (const item of body.tasks ?? []) {
    const extracted = entry.extractionResult.tasks[item.index];
    if (!extracted) continue;
    const task = await createTask({
      title: extracted.title,
      dueDate: extracted.dueDate,
      relatedProspectId: item.prospectId ?? null,
      relatedEmployeeId: entry.relatedEmployeeId,
      createdBy: "ai_inbox_extraction",
      sourceInboxEntryId: id,
    });
    createdTasks.push(task.id);
    await createAuditEvent({
      eventType: "task_created",
      summary: `Extracted task "${extracted.title}" from the Inbox`,
      relatedProspectId: item.prospectId ?? null,
      relatedEmployeeId: entry.relatedEmployeeId,
      actor: "ai_inbox_extraction",
      metadata: { taskId: task.id, sourceInboxEntryId: id },
    });
  }

  const createdDecisions: string[] = [];
  for (const item of body.decisions ?? []) {
    const extracted = entry.extractionResult.decisions[item.index];
    if (!extracted) continue;
    const scope: DecisionScope = entry.relatedProspectId
      ? { type: "prospect", prospectId: entry.relatedProspectId }
      : entry.relatedEmployeeId
        ? { type: "employee", employeeId: entry.relatedEmployeeId }
        : { type: "global" };
    const decision = await createDecision({
      decisionText: extracted.decisionText,
      reason: extracted.reason,
      scope,
      madeBy: "ai_orchestrator",
    });
    createdDecisions.push(decision.id);
    await createAuditEvent({
      eventType: "decision_made",
      summary: decision.decisionText,
      relatedProspectId: entry.relatedProspectId,
      relatedEmployeeId: entry.relatedEmployeeId,
      actor: "ai_inbox_extraction",
      metadata: { decisionId: decision.id, sourceInboxEntryId: id },
    });
  }

  await markInboxEntryReviewed(id);
  await createAuditEvent({
    eventType: "inbox_entry_processed",
    summary: `Applied ${createdFacts.length} fact(s), ${createdTasks.length} task(s), ${createdDecisions.length} decision(s) from the Inbox`,
    relatedProspectId: entry.relatedProspectId,
    relatedEmployeeId: entry.relatedEmployeeId,
    actor: "winston",
    metadata: { inboxEntryId: id },
  });

  return NextResponse.json({ ok: true, createdFacts, createdTasks, createdDecisions });
}
