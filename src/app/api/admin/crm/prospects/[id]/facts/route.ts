import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, createFact, listFacts, type CreateFactInput } from "@/lib/crm";

/** Phase 1 §4.2/§7.2 — the append-only Fact ledger behind a prospect's Intelligence tab. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const facts = await listFacts(id);
  return NextResponse.json({ ok: true, facts });
}

interface RequestBody {
  factType?: CreateFactInput["factType"];
  key?: string;
  value?: string;
  source?: string;
  sourceType?: CreateFactInput["sourceType"];
  confidence?: number | null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.key || !body.value || !body.factType || !body.source || !body.sourceType) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const fact = await createFact({
    prospectId: id,
    factType: body.factType,
    key: body.key,
    value: body.value,
    source: body.source,
    sourceType: body.sourceType,
    confidence: body.confidence ?? null,
  });

  await createAuditEvent({
    eventType: "fact_created",
    summary: `Recorded fact "${body.key}" for prospect`,
    relatedProspectId: id,
    actor: body.sourceType === "human_confirmed" ? "winston" : "ai_inbox_extraction",
    metadata: { factId: fact.id, key: body.key, value: body.value },
  });

  return NextResponse.json({ ok: true, fact });
}
