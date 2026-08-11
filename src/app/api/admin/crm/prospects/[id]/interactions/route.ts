import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { listInteractions, logInteraction } from "@/lib/crm";
import type { Interaction, InteractionOutcome, InteractionType } from "@/lib/crmTypes";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const interactions = await listInteractions(id);
  return NextResponse.json({ ok: true, interactions });
}

interface RequestBody {
  type?: InteractionType;
  outcome?: InteractionOutcome | null;
  rawNote?: string | null;
  createdBy?: string;
  aiExtracted?: Interaction["aiExtracted"];
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

  if (!body.type) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const interaction = await logInteraction(id, {
    type: body.type,
    outcome: body.outcome ?? null,
    rawNote: body.rawNote ?? null,
    createdBy: body.createdBy ?? "Winston",
    aiExtracted: body.aiExtracted ?? null,
  });

  return NextResponse.json({ ok: true, interaction });
}
