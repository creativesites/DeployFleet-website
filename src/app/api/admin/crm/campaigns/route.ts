import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createCampaign, listCampaigns, type CreateCampaignInput } from "@/lib/crm";

/** Phase 0 §6.3 — "Outreach" in the UI. Lists/creates Campaign entities, kept as their own collection distinct from Visitor Intelligence's unrelated /admin/campaigns route. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const campaigns = await listCampaigns();
  return NextResponse.json({ ok: true, campaigns });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let body: CreateCampaignInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (!body.name || !body.name.trim() || !body.startDate) {
    return NextResponse.json({ ok: false, reason: "name_and_start_date_required" }, { status: 400 });
  }

  const campaign = await createCampaign(body);
  return NextResponse.json({ ok: true, campaign });
}
