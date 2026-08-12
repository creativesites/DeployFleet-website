"use client";

import { useEffect, useState } from "react";
import { EMAIL_TEMPLATE_LABEL, type AiEmployee, type EmailTemplateKey, type Prospect } from "@/lib/crmTypes";
import ChatInput from "./ChatInput";
import CopyBriefingButton from "./CopyBriefingButton";

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

const TEMPLATE_ORDER: EmailTemplateKey[] = ["cold_outreach", "followup", "custom"];

/**
 * The one place in the product that actually sends outbound email — see
 * docs/email-templates.md for the account setup this depends on. Every
 * send goes through POST /api/admin/crm/email/send, which enforces the
 * 20/day cap server-side; this panel just reflects that state back
 * (today's count, the disabled-once-reached button) rather than
 * enforcing anything client-side itself.
 *
 * Redesigned around one unified, always-editable subject/body composer
 * (per Winston's ask to edit body content on every preset, not just
 * Custom) rather than three differently-shaped template modes. Picking
 * Cold Outreach or Follow-up fills the composer with deterministic
 * starting text (POST .../email/preset, no AI, instant — see
 * src/lib/email/presets.ts); Custom starts blank. AI Draft/Revise work
 * identically on top of whatever's in the fields regardless of which
 * preset filled them. The composer is a real closable panel (starts
 * collapsed to three preset chips; the header's × discards the draft and
 * returns there) and has a Preview toggle that renders exactly what
 * EmailJS will send — merge tags already resolved, since resolution now
 * happens before the fields are ever shown, not inside EmailJS.
 */
export default function SendEmailPanel({ prospect, onSent }: { prospect: Prospect; onSent?: () => void }) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [mode, setMode] = useState<"closed" | "editing">("closed");
  const [template, setTemplate] = useState<EmailTemplateKey>("cold_outreach");
  const [followupContext, setFollowupContext] = useState(prospect.lastInteractionSummary ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [revision, setRevision] = useState("");
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [employees, setEmployees] = useState<AiEmployee[] | null>(null);
  const [showTeam, setShowTeam] = useState(false);

  useEffect(() => {
    fetch("/api/admin/crm/email/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setStatus(data);
      });
  }, []);

  useEffect(() => {
    if (mode !== "editing" || employees) return;
    fetch("/api/admin/crm/employees")
      .then((res) => res.json())
      .then((data) => data.ok && setEmployees(data.employees.filter((e: AiEmployee) => e.status === "active")));
  }, [mode, employees]);

  async function openPreset(key: EmailTemplateKey) {
    setTemplate(key);
    setResult(null);
    setShowPreview(false);
    setMode("editing");
    if (key === "custom") {
      setSubject("");
      setBody("");
      return;
    }
    setLoadingPreset(true);
    try {
      const res = await fetch("/api/admin/crm/email/preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id, preset: key, followupContext: key === "followup" ? followupContext : undefined }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubject(data.subject);
        setBody(data.body);
      } else {
        setResult({ ok: false, message: "Couldn't load the starting template — try again, or start from Custom." });
      }
    } catch {
      setResult({ ok: false, message: "Network error loading the template." });
    } finally {
      setLoadingPreset(false);
    }
  }

  function closeComposer() {
    setMode("closed");
    setSubject("");
    setBody("");
    setRevision("");
    setShowPreview(false);
    setResult(null);
  }

  async function draftOrRevise(instruction?: string) {
    setDrafting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/crm/email/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          currentSubject: instruction ? subject : undefined,
          currentBody: instruction ? body : undefined,
          instruction,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubject(data.subject);
        setBody(data.body);
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
        body: JSON.stringify({ prospectId: prospect.id, template, subject, body }),
      });
      const data = await res.json();
      if (typeof data.sentToday === "number") {
        setStatus((prev) => (prev ? { ...prev, sentToday: data.sentToday } : prev));
      }
      if (data.ok) {
        setResult({ ok: true, message: `Sent to ${prospect.contactEmail}.` });
        closeComposer();
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

  if (!prospect.contactEmail) {
    return <div className="rounded-df-md border border-border bg-canvas p-3 text-xs text-muted">No email address on file — add one to enable email outreach.</div>;
  }

  const capReached = status ? status.sentToday >= status.cap : false;
  const canSend = subject.trim().length > 0 && body.trim().length > 0;
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Email</p>
        {status && (
          <span className="text-[11px] text-muted">
            {status.sentToday}/{status.cap} sent today
          </span>
        )}
      </div>

      {status && !status.configured ? (
        <p className="mt-2 text-xs text-muted">
          EmailJS isn&apos;t configured yet — see <code>docs/email-templates.md</code> for the env vars and template to set up.
        </p>
      ) : mode === "closed" ? (
        <>
          <p className="mt-2 text-xs text-muted">Start from a preset — every field stays editable before you send.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEMPLATE_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => openPreset(key)}
                disabled={capReached}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-body hover:border-teal/50 hover:text-teal disabled:cursor-not-allowed disabled:opacity-40"
              >
                {EMAIL_TEMPLATE_LABEL[key]}
              </button>
            ))}
          </div>
          {capReached && <p className="mt-2 text-xs text-danger">Today&apos;s 20-email cap is reached — try again tomorrow.</p>}
          {result && <p className={`mt-2 text-xs ${result.ok ? "text-teal" : "text-danger"}`}>{result.message}</p>}
        </>
      ) : (
        <div className="mt-2 rounded-df-md border border-border bg-canvas p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-navy">
              Compose — <span className="font-normal text-muted">{EMAIL_TEMPLATE_LABEL[template]}</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowPreview((v) => !v)} className="text-[11px] font-medium text-teal hover:underline">
                {showPreview ? "Edit" : "Preview"}
              </button>
              <button
                type="button"
                onClick={closeComposer}
                aria-label="Close and discard this draft"
                title="Close and discard this draft"
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-border/60 hover:text-navy"
              >
                ×
              </button>
            </div>
          </div>

          {template === "followup" && !showPreview && (
            <div className="mt-2 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="text-[11px] text-muted">What to reference</label>
                <ChatInput value={followupContext} onChange={setFollowupContext} placeholder="e.g. “our call last Tuesday”" minRows={1} maxRows={3} />
              </div>
              <button
                type="button"
                onClick={() => openPreset("followup")}
                disabled={loadingPreset}
                className="btn-secondary shrink-0 text-xs disabled:opacity-50"
              >
                {loadingPreset ? "Loading…" : "Regenerate opening"}
              </button>
            </div>
          )}

          {loadingPreset ? (
            <p className="mt-3 text-xs text-muted">Loading starting template…</p>
          ) : showPreview ? (
            <div className="mt-3 rounded-df-md border border-border bg-card p-3 text-xs">
              <dl className="space-y-0.5 border-b border-border pb-2">
                <div className="flex gap-1.5">
                  <dt className="font-medium text-muted">To:</dt>
                  <dd className="text-navy">
                    {prospect.contactName ? `${prospect.contactName} ` : ""}
                    &lt;{prospect.contactEmail}&gt;
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="font-medium text-muted">Subject:</dt>
                  <dd className="font-medium text-navy">{subject || <span className="italic text-muted">(no subject)</span>}</dd>
                </div>
              </dl>
              <p className="mt-2 whitespace-pre-wrap text-body">{body || <span className="italic text-muted">(empty)</span>}</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted">Subject &amp; body — edit freely, or let AI draft/revise it</label>
                <button type="button" onClick={() => draftOrRevise()} disabled={drafting} className="text-[11px] font-medium text-teal hover:underline disabled:opacity-50">
                  {drafting ? "Drafting…" : body ? "Regenerate with AI" : "AI draft"}
                </button>
              </div>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                className="w-full rounded-df-md border border-border bg-card px-3 py-2 text-xs font-medium text-navy outline-none focus:border-teal"
              />
              <ChatInput value={body} onChange={setBody} placeholder="Email body…" minRows={6} maxRows={18} />
              <p className="text-right text-[10px] text-muted">{wordCount} word{wordCount === 1 ? "" : "s"}</p>

              {body && (
                <div className="flex gap-2">
                  <input
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    placeholder="Tell AI how to change it — e.g. “shorter and more casual”"
                    className="min-w-0 flex-1 rounded-df-md border border-border bg-card px-3 py-2 text-xs text-navy outline-none focus:border-teal"
                  />
                  <button type="button" onClick={() => draftOrRevise(revision)} disabled={drafting || !revision.trim()} className="btn-secondary shrink-0 text-xs disabled:opacity-50">
                    {drafting ? "Revising…" : "Revise"}
                  </button>
                </div>
              )}
            </div>
          )}

          {employees && employees.length > 0 && (
            <div className="mt-3 border-t border-border pt-2">
              <button type="button" onClick={() => setShowTeam((v) => !v)} className="text-[11px] font-medium text-muted hover:text-navy">
                {showTeam ? "Hide team input ▲" : "Get input from the team ▼"}
              </button>
              {showTeam && (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[11px] text-muted">
                    Copy a ready-to-paste briefing for whichever teammate you want input from, paste it into your chat with them, then bring
                    their reply back via the Employee Intelligence tab.
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {employees.map((emp) => (
                      <CopyBriefingButton
                        key={emp.id}
                        employeeId={emp.id}
                        employeeName={emp.name}
                        prospectId={prospect.id}
                        purpose={`Winston is drafting a ${EMAIL_TEMPLATE_LABEL[template]} email to this prospect. Given your role, what should it say, or what should Winston know before sending it?`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={send} disabled={sending || capReached || !canSend} className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-40">
              {sending ? "Sending…" : capReached ? "Daily cap reached" : `Send to ${prospect.contactEmail}`}
            </button>
            <button type="button" onClick={closeComposer} className="text-xs text-muted hover:text-navy">
              Cancel
            </button>
          </div>

          {result && <p className={`mt-2 text-xs ${result.ok ? "text-teal" : "text-danger"}`}>{result.message}</p>}
        </div>
      )}
    </div>
  );
}
