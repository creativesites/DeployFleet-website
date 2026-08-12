import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getAiEmployee, listInboxEntries, recordWorkerBriefing } from "@/lib/crm";
import { runInboxExtraction } from "@/lib/ai/inboxExtraction";
import type { InboxSourceType } from "@/lib/crmTypes";

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

  const { entry, reason } = await runInboxExtraction({
    rawText: body.rawText,
    sourceType: body.sourceType,
    relatedProspectId: body.relatedProspectId ?? null,
    relatedEmployeeId: body.relatedEmployeeId ?? null,
  });

  // RS-2 §4.2 — an employee-scoped paste counts as that worker's required
  // submission for the current period. Cadence follows the worker's config
  // (daily preferred when set, else weekly). Best-effort: a briefing-record
  // failure never fails the paste the salesperson just made.
  let briefingRecorded = false;
  if (body.relatedEmployeeId) {
    try {
      const employee = await getAiEmployee(body.relatedEmployeeId);
      const cadence = employee?.dailyRequiredInput ? "daily" : employee?.weeklyRequiredInput ? "weekly" : null;
      if (cadence) {
        await recordWorkerBriefing(body.relatedEmployeeId, cadence, entry.id);
        briefingRecorded = true;
      }
    } catch {
      // swallow — the InboxEntry is already saved; completeness is a nicety.
    }
  }

  return NextResponse.json({ ok: true, entry, reason, briefingRecorded });
}
