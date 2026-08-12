import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getProspect } from "@/lib/crm";
import { compileProspectContext } from "@/lib/ai/contextCompiler";
import { completeWithFallback } from "@/lib/ai/router";
import { EMAIL_DRAFT_SYSTEM_PROMPT, EMAIL_REVISE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { parseJsonLoosely } from "@/lib/ai/jsonExtract";

interface RequestBody {
  prospectId?: string;
  /** When set, revises this subject/body against `instruction` instead of drafting from scratch. */
  currentSubject?: string;
  currentBody?: string;
  instruction?: string;
}

interface EmailDraft {
  subject: string;
  body: string;
}

/**
 * The Custom email template's AI assist — drafts a fresh subject/body
 * from scratch, or revises an existing (possibly Winston-edited) one
 * against a plain-language instruction. Always Level 0: this route only
 * ever returns text for SendEmailPanel's editable fields, it never sends
 * anything itself — mirrors whatsapp/draft/route.ts's own discipline.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }
  if (process.env.AI_FEATURES_ENABLED === "false") {
    return NextResponse.json({ ok: false, reason: "ai_disabled" });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }
  if (!body.prospectId) return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });

  const prospect = await getProspect(body.prospectId);
  if (!prospect) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const isRevision = Boolean(body.instruction?.trim());
  const context = await compileProspectContext(body.prospectId);

  const result = isRevision
    ? await completeWithFallback({
        systemPrompt: EMAIL_REVISE_SYSTEM_PROMPT,
        userPrompt: `Current subject: ${body.currentSubject ?? ""}\nCurrent body:\n${body.currentBody ?? ""}\n\nInstruction: ${body.instruction}`,
      })
    : await completeWithFallback({ systemPrompt: EMAIL_DRAFT_SYSTEM_PROMPT, userPrompt: context || `Prospect: ${prospect.name}` });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  const draft = parseJsonLoosely<EmailDraft>(result.text);
  if (!draft || typeof draft.subject !== "string" || typeof draft.body !== "string") {
    return NextResponse.json({ ok: false, reason: "unparseable_response" });
  }

  return NextResponse.json({ ok: true, subject: draft.subject.trim(), body: draft.body.trim() });
}
