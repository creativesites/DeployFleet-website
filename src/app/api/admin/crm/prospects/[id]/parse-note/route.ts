import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getProspect } from "@/lib/crm";
import { completeWithFallback } from "@/lib/ai/router";
import { NOTE_EXTRACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseJsonLoosely } from "@/lib/ai/jsonExtract";
import type { InteractionOutcome, InteractionType, PipelineStage } from "@/lib/crmTypes";

interface RequestBody {
  outcome?: InteractionOutcome;
  rawNote?: string;
}

interface RawExtraction {
  stage: number | null;
  pain: string | null;
  nextActionDate: string | null;
  nextActionType: InteractionType | null;
}

const VALID_INTERACTION_TYPES = new Set<InteractionType>(["call", "whatsapp", "email", "visit", "demo", "note"]);

/**
 * Turns Winston's own quick note into a structured suggestion the Today
 * tab shows him for confirmation — never applied directly. This is a
 * read-only AI call (no Firestore write here); the caller PATCHes the
 * prospect and logs the interaction itself once the human confirms, per
 * brief #35's "no AI write path skips human confirmation."
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }
  if (process.env.AI_FEATURES_ENABLED === "false") {
    return NextResponse.json({ ok: false, reason: "ai_disabled" });
  }

  const { id } = await params;
  const prospect = await getProspect(id);
  if (!prospect) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const rawNote = typeof body.rawNote === "string" ? body.rawNote.slice(0, 2000) : "";
  if (!rawNote.trim()) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const userPrompt = [
    `Company: ${prospect.name}`,
    `Current stage: ${prospect.stage}`,
    body.outcome ? `Outcome tag: ${body.outcome}` : null,
    `Note: ${rawNote}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await completeWithFallback({ systemPrompt: NOTE_EXTRACTION_SYSTEM_PROMPT, userPrompt });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  const raw = parseJsonLoosely<RawExtraction>(result.text);
  if (!raw) {
    return NextResponse.json({ ok: false, reason: "invalid_ai_response" });
  }

  const stage = typeof raw.stage === "number" && raw.stage >= 0 && raw.stage <= 12 ? (raw.stage as PipelineStage) : null;
  const nextActionType = raw.nextActionType && VALID_INTERACTION_TYPES.has(raw.nextActionType) ? raw.nextActionType : null;
  const nextActionDate = typeof raw.nextActionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.nextActionDate) ? raw.nextActionDate : null;

  return NextResponse.json({
    ok: true,
    extraction: {
      stage,
      pain: typeof raw.pain === "string" ? raw.pain : null,
      nextActionDate,
      nextActionType,
    },
  });
}
