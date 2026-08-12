import "server-only";
import type { Prospect } from "@/lib/crmTypes";

/**
 * Deterministic starting text for the two structured email presets
 * (Cold Outreach / Follow-up) — the single source of truth this app's
 * copy comes from (docs/email-templates.md mirrors it for reference,
 * doesn't own it). Previously this copy lived only inside EmailJS's own
 * dashboard template Content field, which meant it couldn't be edited
 * per-send — every send used the exact same wording apart from a
 * handful of merge tags. Winston asked to be able to edit the body
 * content itself while staying "inline with our template," so this is
 * now the deterministic fill for an editable subject/body pair
 * (SendEmailPanel), not baked-in EmailJS content — one thin pass-through
 * EmailJS template ({{subject}}/{{body}}) now handles every send,
 * regardless of which preset it started from. See docs/email-templates.md
 * for the full reasoning behind this consolidation.
 */

export interface EmailPreset {
  subject: string;
  body: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

function signOff(): string {
  const senderName = process.env.EMAIL_SENDER_NAME || "Winston";
  const senderRole = process.env.EMAIL_SENDER_ROLE || "DeployFleet";
  const replyTo = process.env.EMAIL_REPLY_TO || "";
  return [senderName, senderRole, "DeployFleet", replyTo].filter(Boolean).join("\n");
}

export function coldOutreachPreset(prospect: Prospect): EmailPreset {
  const toName = prospect.contactName || prospect.name;
  const demoLink = `${siteUrl()}/demo`;
  return {
    subject: `${prospect.name} + DeployFleet — a quick question about your fleet`,
    body: [
      `Hi ${toName},`,
      "",
      `I'm ${process.env.EMAIL_SENDER_NAME || "Winston"} with DeployFleet — we build fleet management software for trucking and logistics companies here in Zambia.`,
      "",
      `I came across ${prospect.name} and had a quick question: how are you currently tracking fuel costs, maintenance schedules, and driver pay across your fleet? Most operators we talk to are still doing this across spreadsheets, WhatsApp, and paper logs — which works, until it doesn't.`,
      "",
      `DeployFleet puts dispatch, fuel, maintenance, compliance documents, and billing in one place, with a live demo you can try without signing up: ${demoLink}`,
      "",
      `Worth a quick 15-minute call to see if it's a fit for how ${prospect.name} runs today?`,
      "",
      signOff(),
    ].join("\n"),
  };
}

export function followupPreset(prospect: Prospect, followupContext?: string): EmailPreset {
  const toName = prospect.contactName || prospect.name;
  const demoLink = `${siteUrl()}/demo`;
  const context = followupContext?.trim() || prospect.lastInteractionSummary || "our last conversation";
  return {
    subject: `Following up — ${prospect.name} and DeployFleet`,
    body: [
      `Hi ${toName},`,
      "",
      `Following up on ${context} — wanted to check in and see if there's anything I can answer or send over that would help you make a call on DeployFleet for ${prospect.name}.`,
      "",
      "If now isn't the right time, no problem at all — just let me know and I'll check back later rather than keep following up.",
      "",
      `If you'd like another look at the live demo, it's still here: ${demoLink}`,
      "",
      signOff(),
    ].join("\n"),
  };
}
