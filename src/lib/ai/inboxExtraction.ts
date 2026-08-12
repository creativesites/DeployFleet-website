import "server-only";
import { createInboxEntry, setInboxEntryExtraction } from "@/lib/crm";
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
  InboxEntry,
  InboxSourceType,
} from "@/lib/crmTypes";

/**
 * §7.1's "paste everything, extract, review, apply" pipeline, factored
 * out of POST /api/admin/crm/inbox so the exact same mechanism can be
 * reused by the WhatsApp webhook handler (§7 of
 * docs/whatsapp-intelligence-architecture.md: "reuses the AI Inbox's
 * exact apply mechanism... not a new write path"). Still writes only an
 * InboxEntry — no Fact/Task/Decision is ever created here; only the
 * human-approved POST .../inbox/[id]/apply route does that (brief #35).
 */

interface RawExtraction {
  facts?: ExtractedFact[];
  tasks?: ExtractedTask[];
  decisions?: ExtractedDecision[];
  risks?: string[];
  recommendations?: string[];
  contradictions?: ExtractedContradiction[];
  competitors?: string[];
  decisionMakers?: string[];
  unansweredQuestions?: string[];
  timeline?: string | null;
  budget?: string | null;
}

/** Guard the model's arrays down to clean string[] (drops non-strings/empties) — the richer RS-2 fields are display-only, so a loose model response degrades to fewer chips, never a crash. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export interface RunInboxExtractionInput {
  rawText: string;
  sourceType: InboxSourceType;
  relatedProspectId?: string | null;
  relatedEmployeeId?: string | null;
}

export interface RunInboxExtractionResult {
  entry: InboxEntry;
  reason?: string;
}

export async function runInboxExtraction(input: RunInboxExtractionInput): Promise<RunInboxExtractionResult> {
  const entry = await createInboxEntry({
    rawText: input.rawText,
    sourceType: input.sourceType,
    relatedProspectId: input.relatedProspectId ?? null,
    relatedEmployeeId: input.relatedEmployeeId ?? null,
  });

  if (process.env.AI_FEATURES_ENABLED === "false") {
    await setInboxEntryExtraction(entry.id, "failed", null);
    return { entry: { ...entry, extractionStatus: "failed" }, reason: "ai_disabled" };
  }

  const contextParts = await Promise.all([
    input.relatedProspectId ? compileProspectContext(input.relatedProspectId) : Promise.resolve(""),
    input.relatedEmployeeId ? compileEmployeeContext(input.relatedEmployeeId) : Promise.resolve(""),
  ]);
  const knownContext = contextParts.filter(Boolean).join("\n\n");
  const userPrompt = knownContext ? `Known context:\n${knownContext}\n\nText to process:\n${input.rawText}` : `Text to process:\n${input.rawText}`;

  const result = await completeWithFallback({ systemPrompt: INBOX_EXTRACTION_SYSTEM_PROMPT, userPrompt });
  if (!result.ok) {
    await setInboxEntryExtraction(entry.id, "failed", null);
    return { entry: { ...entry, extractionStatus: "failed" }, reason: result.reason };
  }

  const raw = parseJsonLoosely<RawExtraction>(result.text);
  if (!raw) {
    await setInboxEntryExtraction(entry.id, "failed", null);
    return { entry: { ...entry, extractionStatus: "failed" }, reason: "invalid_ai_response" };
  }

  let callAnalysis: CallAnalysis | null = null;
  if (input.sourceType === "call_transcript") {
    const coachResult = await completeWithFallback({ systemPrompt: SALES_COACH_SYSTEM_PROMPT, userPrompt: input.rawText });
    if (coachResult.ok) callAnalysis = parseJsonLoosely<CallAnalysis>(coachResult.text);
  }

  const extraction: ExtractionResult = {
    facts: raw.facts ?? [],
    tasks: raw.tasks ?? [],
    decisions: raw.decisions ?? [],
    risks: raw.risks ?? [],
    recommendations: raw.recommendations ?? [],
    contradictions: raw.contradictions ?? [],
    competitors: stringList(raw.competitors),
    decisionMakers: stringList(raw.decisionMakers),
    unansweredQuestions: stringList(raw.unansweredQuestions),
    timeline: nullableString(raw.timeline),
    budget: nullableString(raw.budget),
    callAnalysis,
  };

  await setInboxEntryExtraction(entry.id, "processed", extraction);
  return { entry: { ...entry, extractionStatus: "processed", extractionResult: extraction } };
}
