import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, createDirective, listDirectives, type CreateDirectiveInput } from "@/lib/crm";
import type { DirectiveStatus } from "@/lib/crmTypes";

/** Revenue OS RS-0 §4.1 — CEO/company directives pinned to the Command Strip. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const directives = await listDirectives({ status: (status as DirectiveStatus) ?? undefined });
  return NextResponse.json({ ok: true, directives });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: CreateDirectiveInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.title || !body.title.trim() || typeof body.body !== "string") {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const directive = await createDirective({
    title: body.title.trim(),
    body: body.body.trim(),
    weekOf: body.weekOf ?? null,
  });

  await createAuditEvent({
    eventType: "decision_made",
    summary: `Directive set: ${directive.title}`,
    actor: "winston",
    metadata: { directiveId: directive.id, weekOf: directive.weekOf },
  });

  return NextResponse.json({ ok: true, directive });
}
