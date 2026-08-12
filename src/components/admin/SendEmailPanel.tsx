"use client";

import { useEffect, useState } from "react";
import { EMAIL_TEMPLATE_LABEL, type EmailTemplateKey, type Prospect } from "@/lib/crmTypes";
import ChatInput from "./ChatInput";

interface EmailStatus {
  configured: boolean;
  sentToday: number;
  cap: number;
}

function describeFailure(reason: string | undefined, detail?: string): string {
  switch (reason) {
    case "emailjs_not_configured":
      return "EmailJS isn't configured yet — see docs/email-templates.md.";
    case "no_email_on_file":
      return "No email address on file for this prospect.";
    case "daily_cap_reached":
      return "Today's 20-email cap is reached — try again tomorrow.";
    case "not_found":
      return "Prospect not found.";
    case "send_failed":
      // "The recipients address is empty" from EmailJS almost always means
      // the template's own Settings → "To Email" field (in the EmailJS
      // dashboard) isn't set to {{to_email}} — see docs/email-templates.md
      // step 2's "Recipient settings" note. This app already sends
      // to_email correctly; that error is EmailJS-side template config.
      return `EmailJS couldn't send this${detail ? `: ${detail}` : ""}.${
        detail?.toLowerCase().includes("recipient") ? ' Check the template’s "To Email" field in the EmailJS dashboard — see docs/email-templates.md.' : ""
      }`;
    default:
      return "Couldn't send this email.";
  }
}

/**
 * The one place in the product that actually sends outbound email — see
 * docs/email-templates.md for the account setup this depends on. Every
 * send goes through POST /api/admin/crm/email/send, which enforces the
 * 20/day cap server-side; this panel just reflects that state back
 * (today's count, the disabled-once-reached button) rather than
 * enforcing anything client-side itself.
 */
export default function SendEmailPanel({ prospect, onSent }: { prospect: Prospect; onSent?: () => void }) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [template, setTemplate] = useState<EmailTemplateKey>("cold_outreach");
  const [followupContext, setFollowupContext] = useState(prospect.lastInteractionSummary ?? "");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [revision, setRevision] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/crm/email/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setStatus(data);
      });
  }, []);

  async function draftOrRevise(instruction?: string) {
    setDrafting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/crm/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          currentSubject: instruction ? customSubject : undefined,
          currentBody: instruction ? customBody : undefined,
          instruction,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCustomSubject(data.subject);
        setCustomBody(data.body);
        setRevision("");
      } else {
        setResult({ ok: false, message: data.reason === "ai_disabled" ? "AI is currently disabled." : "Couldn't generate a draft right now." });
      }
    } catch {
      setResult({ ok: false, message: "Network error." });
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/crm/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          template,
          followupContext: template === "followup" ? followupContext : undefined,
          customSubject: template === "custom" ? customSubject : undefined,
          customBody: template === "custom" ? customBody : undefined,
        }),
      });
      const data = await res.json();
      if (typeof data.sentToday === "number") {
        setStatus((prev) => (prev ? { ...prev, sentToday: data.sentToday } : prev));
      }
      if (data.ok) {
        setResult({ ok: true, message: `Sent to ${prospect.contactEmail}.` });
        if (template === "custom") {
          setCustomSubject("");
          setCustomBody("");
        }
        onSent?.();
      } else {
        setResult({ ok: false, message: describeFailure(data.reason, data.detail) });
      }
    } catch {
      setResult({ ok: false, message: "Network error — nothing was sent." });
    } finally {
      setSending(false);
    }
  }

  const canSendCustom = template !== "custom" || (customSubject.trim().length > 0 && customBody.trim().length > 0);

  if (!prospect.contactEmail) {
    return <div className="rounded-df-md border border-border bg-canvas p-3 text-xs text-muted">No email address on file — add one to enable email outreach.</div>;
  }

  const capReached = status ? status.sentToday >= status.cap : false;

  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Send email</p>
        {status && (
          <span className="text-[11px] text-muted">
            {status.sentToday}/{status.cap} sent today
          </span>
        )}
      </div>

      {status && !status.configured ? (
        <p className="mt-2 text-xs text-muted">
          EmailJS isn&apos;t configured yet — see <code>docs/email-templates.md</code> for the env vars and templates to set up.
        </p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.entries(EMAIL_TEMPLATE_LABEL) as [EmailTemplateKey, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTemplate(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  template === value ? "border-teal bg-teal/10 text-teal" : "border-border text-body hover:border-teal/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {template === "followup" && (
            <div className="mt-2">
              <ChatInput
                value={followupContext}
                onChange={setFollowupContext}
                placeholder="What to reference — e.g. “our call last Tuesday”"
                minRows={1}
                maxRows={4}
              />
            </div>
          )}

          {template === "custom" && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted">Subject &amp; body — edit freely, or let AI draft/revise it</p>
                <button
                  type="button"
                  onClick={() => draftOrRevise()}
                  disabled={drafting}
                  className="text-[11px] font-medium text-teal hover:underline disabled:opacity-50"
                >
                  {drafting ? "Drafting…" : customBody ? "Regenerate with AI" : "AI draft"}
                </button>
              </div>
              <input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder="Subject line"
                className="w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
              />
              <ChatInput value={customBody} onChange={setCustomBody} placeholder="Email body…" minRows={5} maxRows={16} />

              {customBody && (
                <div className="flex gap-2">
                  <input
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    placeholder="Tell AI how to change it — e.g. “shorter and more casual”"
                    className="min-w-0 flex-1 rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
                  />
                  <button
                    type="button"
                    onClick={() => draftOrRevise(revision)}
                    disabled={drafting || !revision.trim()}
                    className="btn-secondary text-xs disabled:opacity-50"
                  >
                    {drafting ? "Revising…" : "Revise"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={send}
            disabled={sending || capReached || !canSendCustom}
            className="btn-primary mt-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "Sending…" : capReached ? "Daily cap reached" : `Send to ${prospect.contactEmail}`}
          </button>

          {result && <p className={`mt-2 text-xs ${result.ok ? "text-teal" : "text-danger"}`}>{result.message}</p>}
        </>
      )}
    </div>
  );
}
