import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { createAuditEvent, getProspect, getProspectContact, updateProspect, updateProspectContact } from "@/lib/crm";
import { checkAvailability, isGatewayConfigured } from "@/lib/whatsapp/gatewayClient";

interface RequestBody {
  prospectId?: string;
  contactId?: string;
}

/**
 * §6/§14 WA-1 — checkAvailability(), called on-demand only (§15's
 * resolved rate-limit-safety decision), never in a batch job. Verifies
 * either the prospect's own primary number or one ProspectContact's
 * number, writes the result with a fresh whatsappVerifiedAt timestamp —
 * never inferred, never assumed still valid.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }
  if (!isGatewayConfigured()) {
    return NextResponse.json({ ok: false, reason: "gateway_not_configured" });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }
  if (!body.prospectId) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const prospect = await getProspect(body.prospectId);
  if (!prospect) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });

  const phone = body.contactId ? (await getProspectContact(body.contactId))?.phone : (prospect.contactWhatsapp ?? prospect.contactPhone);
  if (!phone) return NextResponse.json({ ok: false, reason: "no_phone_on_file" });

  const result = await checkAvailability(phone);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason ?? "gateway_error" });
  }

  const now = new Date().toISOString();
  const status = result.exists ? "verified" : "unavailable";

  if (body.contactId) {
    await updateProspectContact(body.contactId, { whatsappStatus: status, whatsappVerifiedAt: now, whatsappJid: result.jid ?? null });
  } else {
    await updateProspect(body.prospectId, { whatsappStatus: status, whatsappVerifiedAt: now, whatsappJid: result.jid ?? null });
  }

  await createAuditEvent({
    eventType: "whatsapp_verified",
    summary: `${prospect.name}: WhatsApp number ${result.exists ? "verified" : "not found on WhatsApp"}`,
    relatedProspectId: body.prospectId,
    actor: "winston",
    metadata: { contactId: body.contactId ?? null, phone, exists: result.exists },
  });

  return NextResponse.json({ ok: true, status, jid: result.jid ?? null, verifiedAt: now });
}
