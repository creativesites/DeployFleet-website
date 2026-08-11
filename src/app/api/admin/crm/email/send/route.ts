import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccess";
import { isFirebaseAdminConfigured } from "@/lib/firebaseAdmin";
import { countEmailSendsToday, createAuditEvent, createEmailSend, DAILY_EMAIL_CAP, getProspect, logInteraction } from "@/lib/crm";
import { isEmailJsConfigured, sendEmailJsTemplate } from "@/lib/email/emailjs";
import { EMAIL_TEMPLATE_LABEL, type EmailTemplateKey } from "@/lib/crmTypes";

const TEMPLATE_ENV_KEY: Record<EmailTemplateKey, string> = {
  cold_outreach: "NEXT_PUBLIC_EMAILJS_TEMPLATE_COLD_OUTREACH",
  followup: "NEXT_PUBLIC_EMAILJS_TEMPLATE_FOLLOWUP",
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

interface RequestBody {
  prospectId?: string;
  template?: EmailTemplateKey;
  followupContext?: string;
}

/**
 * The one route that actually sends outbound email — see
 * docs/email-templates.md for the account/template setup and
 * src/lib/email/emailjs.ts for why the send call itself happens here,
 * server-side, rather than via EmailJS's browser SDK. Everything below
 * runs in one request: cap check → send → log, so there's no gap a
 * client could exploit to send without the cap being enforced.
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

  if (!body.prospectId || !body.template || !(body.template in TEMPLATE_ENV_KEY)) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const templateId = process.env[TEMPLATE_ENV_KEY[body.template]];
  if (!isEmailJsConfigured() || !templateId) {
    return NextResponse.json({ ok: false, reason: "emailjs_not_configured" });
  }

  const prospect = await getProspect(body.prospectId);
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

  const senderName = process.env.EMAIL_SENDER_NAME || "Winston";
  const senderRole = process.env.EMAIL_SENDER_ROLE || "DeployFleet";
  const replyTo = process.env.EMAIL_REPLY_TO || "";
  const demoLink = `${siteUrl()}/demo`;
  const toName = prospect.contactName || prospect.name;

  const templateParams: Record<string, string> =
    body.template === "cold_outreach"
      ? {
          to_name: toName,
          to_email: prospect.contactEmail,
          company_name: prospect.name,
          demo_link: demoLink,
          from_name: senderName,
          from_role: senderRole,
          reply_to: replyTo,
        }
      : {
          to_name: toName,
          to_email: prospect.contactEmail,
          company_name: prospect.name,
          followup_context: body.followupContext?.trim() || prospect.lastInteractionSummary || "our last conversation",
          demo_link: demoLink,
          from_name: senderName,
          from_role: senderRole,
          reply_to: replyTo,
        };

  const result = await sendEmailJsTemplate(templateId, templateParams);

  const emailSend = await createEmailSend({
    prospectId: prospect.id,
    recipientEmail: prospect.contactEmail,
    template: body.template,
    campaignId: prospect.campaignId,
    status: result.ok ? "sent" : "failed",
    errorMessage: result.errorMessage ?? null,
  });

  if (result.ok) {
    await logInteraction(prospect.id, {
      type: "email",
      outcome: null,
      rawNote: `Sent ${EMAIL_TEMPLATE_LABEL[body.template]} email.`,
      createdBy: "Winston",
    });
    await createAuditEvent({
      eventType: "email_sent",
      summary: `Sent ${EMAIL_TEMPLATE_LABEL[body.template]} email to ${prospect.name}`,
      relatedProspectId: prospect.id,
      actor: "winston",
      metadata: { emailSendId: emailSend.id, template: body.template },
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
