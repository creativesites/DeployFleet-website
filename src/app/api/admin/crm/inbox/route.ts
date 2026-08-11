import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createInboxEntry, listInboxEntries, setInboxEntryExtraction } from "@/lib/crm";
import { compileEmployeeContext, compileProspectContext } from "@/lib/ai/contextCompiler";
import { completeWithFallback } from "@/lib/ai/router";
import { INBOX_EXTRACTION_SYSTEM_PROMPT, SALES_COACH_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseJsonLoosely } from "@/lib/ai/jsonExtract";
import type {
  CallAnalysis,
  ExtractedContradiction,
  ExtractedDecision,
  ExtractedFact,
  ExtractedTask,
  ExtractionResult,
  InboxSourceType,
} from "@/lib/crmTypes";

/** Phase 1 §7.1 — the AI Inbox's list, scoped by prospect/employee/neither. */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const entries = await listInboxEntries({
    relatedProspectId: params.get("relatedProspectId") ?? undefined,
    relatedEmployeeId: params.get("relatedEmployeeId") ?? undefined,
  });
  return NextResponse.json({ ok: true, entries });
}

interface RequestBody {
  rawText: string;
  sourceType: InboxSourceType;
  relatedProspectId?: string | null;
  relatedEmployeeId?: string | null;
}

interface RawExtraction {
  facts?: ExtractedFact[];
  tasks?: ExtractedTask[];
  decisions?: ExtractedDecision[];
  risks?: string[];
  recommendations?: string[];
  contradictions?: ExtractedContradiction[];
}

/**
 * §7.1's "paste everything" flow, step 1-3: creates the immutable
 * InboxEntry, then immediately runs extraction (and, for a call
 * transcript, the §6.4 Sales Coach pass) and stores the result as a
 * *proposal* (extractionStatus: "processed", reviewedByWinston: false).
 * Nothing here writes to facts/tasks/decisions/prospects — only the
 * human-approved POST .../[id]/apply route does (brief #35).
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.rawText || !body.rawText.trim() || !body.sourceType) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const entry = await createInboxEntry({
    rawText: body.rawText,
    sourceType: body.sourceType,
    relatedProspectId: body.relatedProspectId ?? null,
    relatedEmployeeId: body.relatedEmployeeId ?? null,
  });

  if (process.env.AI_FEATURES_ENABLED === "false") {
    await setInboxEntryExtraction(entry.id, "failed", null);
    return NextResponse.json({ ok: true, entry: { ...entry, extractionStatus: "failed" }, reason: "ai_disabled" });
  }

  const contextParts = await Promise.all([
    body.relatedProspectId ? compileProspectContext(body.relatedProspectId) : Promise.resolve(""),
    body.relatedEmployeeId ? compileEmployeeContext(body.relatedEmployeeId) : Promise.resolve(""),
  ]);
  const knownContext = contextParts.filter(Boolean).join("\n\n");
  const userPrompt = knownContext ? `Known context:\n${knownContext}\n\nText to process:\n${body.rawText}` : `Text to process:\n${body.rawText}`;

  const result = await completeWithFallback({ systemPrompt: INBOX_EXTRACTION_SYSTEM_PROMPT, userPrompt });
  if (!result.ok) {
    await setInboxEntryExtraction(entry.id, "failed", null);
    return NextResponse.json({ ok: true, entry: { ...entry, extractionStatus: "failed" }, reason: result.reason });
  }

  const raw = parseJsonLoosely<RawExtraction>(result.text);
  if (!raw) {
    await setInboxEntryExtraction(entry.id, "failed", null);
    return NextResponse.json({ ok: true, entry: { ...entry, extractionStatus: "failed" }, reason: "invalid_ai_response" });
  }

  let callAnalysis: CallAnalysis | null = null;
  if (body.sourceType === "call_transcript") {
    const coachResult = await completeWithFallback({ systemPrompt: SALES_COACH_SYSTEM_PROMPT, userPrompt: body.rawText });
    if (coachResult.ok) callAnalysis = parseJsonLoosely<CallAnalysis>(coachResult.text);
  }

  const extraction: ExtractionResult = {
    facts: raw.facts ?? [],
    tasks: raw.tasks ?? [],
    decisions: raw.decisions ?? [],
    risks: raw.risks ?? [],
    recommendations: raw.recommendations ?? [],
    contradictions: raw.contradictions ?? [],
    callAnalysis,
  };

  await setInboxEntryExtraction(entry.id, "processed", extraction);

  return NextResponse.json({ ok: true, entry: { ...entry, extractionStatus: "processed", extractionResult: extraction } });
}
