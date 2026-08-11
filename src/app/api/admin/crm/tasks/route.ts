import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, createTask, listTasks, type CreateTaskInput } from "@/lib/crm";
import type { TaskStatus } from "@/lib/crmTypes";

/** Phase 1 §4.3 — shared across the Prospect page's Objectives section and the Team page's per-employee task list, since a Task can be scoped to either (or neither). */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const relatedProspectId = params.get("relatedProspectId");
  const relatedEmployeeId = params.get("relatedEmployeeId");
  const status = params.get("status");

  const tasks = await listTasks({
    relatedProspectId: relatedProspectId ?? undefined,
    relatedEmployeeId: relatedEmployeeId ?? undefined,
    status: (status as TaskStatus) ?? undefined,
  });
  return NextResponse.json({ ok: true, tasks });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: CreateTaskInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ ok: false, reason: "title_required" }, { status: 400 });
  }

  const task = await createTask(body);
  await createAuditEvent({
    eventType: "task_created",
    summary: `Created task "${task.title}"`,
    relatedProspectId: body.relatedProspectId ?? null,
    relatedEmployeeId: body.relatedEmployeeId ?? null,
    actor: body.createdBy === "human" ? "winston" : body.createdBy,
    metadata: { taskId: task.id },
  });

  return NextResponse.json({ ok: true, task });
}
