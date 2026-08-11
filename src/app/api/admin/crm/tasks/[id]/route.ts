import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, updateTask, type UpdateTaskInput } from "@/lib/crm";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: UpdateTaskInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  await updateTask(id, body);

  if (body.status === "done") {
    await createAuditEvent({
      eventType: "task_completed",
      summary: `Marked task complete`,
      actor: "winston",
      metadata: { taskId: id },
    });
  }

  return NextResponse.json({ ok: true });
}
