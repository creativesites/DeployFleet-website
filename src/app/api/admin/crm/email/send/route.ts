import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { countEmailSendsToday, createAuditEvent, createEmailSend, DAILY_EMAIL_CAP, getProspect, logInteraction } from "@/lib/crm";
import { isEmailJsConfigured, sendEmailJsTemplate } from "@/lib/email/emailjs";
import { EMAIL_TEMPLATE_LABEL, type EmailTemplateKey } from "@/lib/crmTypes";

interface RequestBody {
  prospectId?: string;
  /** Which preset the email started from — audit/reporting metadata only now, doesn't select a different EmailJS template. See src/lib/email/presets.ts. */
  template?: EmailTemplateKey;
  /** The exact subject/body Winston reviewed in SendEmailPanel (whether typed by hand, filled from a preset, or AI-drafted/revised) — sent verbatim, every template. */
  subject?: string;
  body?: string;
}

/**
 * The one route that actually sends outbound email — see
 * docs/email-templates.md for the account/template setup and
 * src/lib/email/emailjs.ts for why the send call itself happens here,
 * server-side, rather than via EmailJS's browser SDK. Everything below
 * runs in one request: cap check → send → log, so there's no gap a
 * client could exploit to send without the cap being enforced.
 *
 * Consolidated onto a single EmailJS template (NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
 * a thin {{subject}}/{{body}} pass-through) rather than the three separate
 * templates this route used to select between — Winston asked to be able
 * to edit the body content of every email, not just the "Custom" one, so
 * every preset now flows through the same editable subject/body pair
 * before reaching this route. See docs/email-templates.md for the
 * migration note.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ ok: false, reason: "firebase_not_configured" }, { status: 503 });
  }

  let requestBody: RequestBody;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const template = requestBody.template ?? "custom";
  if (!requestBody.prospectId || !requestBody.subject?.trim() || !requestBody.body?.trim()) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  if (!isEmailJsConfigured() || !templateId) {
    return NextResponse.json({ ok: false, reason: "emailjs_not_configured" });
  }

  const prospect = await getProspect(requestBody.prospectId);
  if (!prospect) {
    return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  }
  if (!prospect.contactEmail) {
    return NextResponse.json({ ok: false, reason: "no_email_on_file" });
  }

  const sentToday = await countEmailSendsToday();
  if (sentToday >= DAILY_EMAIL_CAP) {
    return NextResponse.json({ ok: false, reason: "daily_cap_reached", sentToday, cap: DAILY_EMAIL_CAP });
  }

  const toName = prospect.contactName || prospect.name;
  const templateParams: Record<string, string> = {
    to_name: toName,
    to_email: prospect.contactEmail,
    company_name: prospect.name,
    subject: requestBody.subject.trim(),
    body: requestBody.body.trim(),
  };

  const result = await sendEmailJsTemplate(templateId, templateParams);

  const emailSend = await createEmailSend({
    prospectId: prospect.id,
    recipientEmail: prospect.contactEmail,
    template,
    campaignId: prospect.campaignId,
    status: result.ok ? "sent" : "failed",
    errorMessage: result.errorMessage ?? null,
  });

  if (result.ok) {
    await logInteraction(prospect.id, {
      type: "email",
      outcome: null,
      rawNote: `Sent ${EMAIL_TEMPLATE_LABEL[template]} email: "${requestBody.subject!.trim()}"`,
      createdBy: "Winston",
    });
    await createAuditEvent({
      eventType: "email_sent",
      summary: `Sent ${EMAIL_TEMPLATE_LABEL[template]} email to ${prospect.name}`,
      relatedProspectId: prospect.id,
      actor: "winston",
      metadata: { emailSendId: emailSend.id, template },
    });
  }

  return NextResponse.json({
    ok: result.ok,
    reason: result.ok ? undefined : "send_failed",
    detail: result.ok ? undefined : result.errorMessage,
    sentToday: sentToday + (result.ok ? 1 : 0),
    cap: DAILY_EMAIL_CAP,
  });
}
