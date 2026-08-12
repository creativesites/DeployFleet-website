import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getAiEmployee } from "@/lib/crm";
import { compileProspectContext } from "@/lib/ai/contextCompiler";
import { buildEmployeeBriefing } from "@/lib/ai/briefing";

interface RequestBody {
  employeeId?: string;
  prospectId?: string;
  purpose?: string;
}

/**
 * "Copy briefing for [employee]" — the concrete, buildable half of
 * Winston's "make the team work cohesively" ask: a one-click, fully
 * formatted, ready-to-paste briefing (this employee's role/mission/
 * instructions + everything this app knows about the prospect, reusing
 * the exact same compileProspectContext() every AI call in this app
 * already builds prompts from) for Winston to paste into his external
 * chat with that AI teammate. No AI call happens here — this is plain
 * server-side text assembly, instant, deterministic.
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
  if (!body.employeeId) return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });

  const employee = await getAiEmployee(body.employeeId);
  if (!employee) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const context = body.prospectId ? await compileProspectContext(body.prospectId) : "";
  const briefing = buildEmployeeBriefing(employee, context, body.purpose);

  return NextResponse.json({ ok: true, briefing });
}
