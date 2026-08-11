import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { listAuditEvents, listDecisions, listFacts, listInteractions, listTasks } from "@/lib/crm";

interface TimelineEntry {
  kind: "interaction" | "fact" | "task" | "decision" | "audit_event";
  at: string;
  summary: string;
  detail: string | null;
}

/** Phase 1 §7.2's Timeline tab — a merged, chronological view of everything that's happened for one prospect. Computed on read, not a stored collection. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const [interactions, facts, tasks, decisions, auditEvents] = await Promise.all([
    listInteractions(id),
    listFacts(id),
    listTasks({ relatedProspectId: id }),
    listDecisions(),
    listAuditEvents({ relatedProspectId: id }),
  ]);

  const entries: TimelineEntry[] = [
    ...interactions.map(
      (i): TimelineEntry => ({
        kind: "interaction",
        at: i.createdAt,
        summary: `${i.type}${i.outcome ? ` — ${i.outcome}` : ""}`,
        detail: i.rawNote,
      })
    ),
    ...facts.map(
      (f): TimelineEntry => ({
        kind: "fact",
        at: f.createdAt,
        summary: `Fact: ${f.key} = ${f.value}`,
        detail: `Source: ${f.source} (${f.sourceType})`,
      })
    ),
    ...tasks.map(
      (t): TimelineEntry => ({
        kind: "task",
        at: t.createdAt,
        summary: `Task: ${t.title}`,
        detail: t.dueDate ? `Due ${t.dueDate} — ${t.status}` : t.status,
      })
    ),
    ...decisions
      .filter((d) => d.scope.type === "prospect" && d.scope.prospectId === id)
      .map(
        (d): TimelineEntry => ({
          kind: "decision",
          at: d.createdAt,
          summary: `Decision: ${d.decisionText}`,
          detail: d.reason,
        })
      ),
    ...auditEvents.map(
      (e): TimelineEntry => ({
        kind: "audit_event",
        at: e.createdAt,
        summary: e.summary,
        detail: e.actor,
      })
    ),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  return NextResponse.json({ ok: true, entries });
}
