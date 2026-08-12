import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getProspect } from "@/lib/crm";
import { compileProspectContext } from "@/lib/ai/contextCompiler";
import { completeWithFallback } from "@/lib/ai/router";
import { WHATSAPP_DRAFT_SYSTEM_PROMPT } from "@/lib/ai/prompts";

interface RequestBody {
  prospectId?: string;
}

/** §8/§14 WA-3 — drafts a message for Winston to review/edit before Send; never sends anything itself. */
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

  const context = await compileProspectContext(body.prospectId);
  const result = await completeWithFallback({ systemPrompt: WHATSAPP_DRAFT_SYSTEM_PROMPT, userPrompt: context || `Prospect: ${prospect.name}` });
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  return NextResponse.json({ ok: true, draft: result.text.trim() });
}
