import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { getCampaignScoreboard, updateCampaign, type UpdateCampaignInput } from "@/lib/crm";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  const scoreboard = await getCampaignScoreboard(id);
  if (!scoreboard) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...scoreboard });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  const { id } = await params;
  let body: UpdateCampaignInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  await updateCampaign(id, body);
  return NextResponse.json({ ok: true });
}
