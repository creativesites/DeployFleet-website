import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { updateDirective, type UpdateDirectiveInput } from "@/lib/crm";

/** Revenue OS RS-0 §4.1 — edit a directive or archive it (status: "archived"). Directives are archived, never hard-deleted. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: UpdateDirectiveInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  await updateDirective(id, body);
  return NextResponse.json({ ok: true });
}
