import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getProspect } from "@/lib/crm";
import { coldOutreachPreset, followupPreset } from "@/lib/email/presets";

interface RequestBody {
  prospectId?: string;
  preset?: "cold_outreach" | "followup";
  followupContext?: string;
}

/**
 * Deterministic, no-AI, instant — the starting subject/body text for a
 * Cold Outreach or Follow-up email, always editable from there (see
 * src/lib/email/presets.ts for why this replaced baked-in EmailJS
 * template content). Distinct from POST .../email/draft, which is the
 * AI-assisted path; this route never calls a provider.
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
  if (!body.prospectId || (body.preset !== "cold_outreach" && body.preset !== "followup")) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const prospect = await getProspect(body.prospectId);
  if (!prospect) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const preset = body.preset === "cold_outreach" ? coldOutreachPreset(prospect) : followupPreset(prospect, body.followupContext);
  return NextResponse.json({ ok: true, subject: preset.subject, body: preset.body });
}
