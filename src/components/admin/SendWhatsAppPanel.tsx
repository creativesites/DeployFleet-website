"use client";

import { useEffect, useState } from "react";
import type { Prospect } from "@/lib/crmTypes";
import ChatInput from "./ChatInput";

interface WhatsAppStatus {
  configured: boolean;
  gateway: { connected: boolean; phoneNumber: string | null; status: "idle" | "connecting" | "connected" };
  sentToday: number;
  cap: number;
}

function describeFailure(reason: string | undefined): string {
  switch (reason) {
    case "gateway_not_configured":
      return "The WhatsApp gateway isn't configured yet — see whatsapp-service/README.md.";
    case "not_verified":
      return "This number hasn't been verified on WhatsApp yet — verify it first.";
    case "opted_out":
      return "This prospect opted out of WhatsApp — sending is permanently blocked.";
    case "daily_cap_reached":
      return "Today's 20-message cap is reached — try again tomorrow.";
    case "cooldown_active":
      return "A message was already sent to this prospect in the last 24 hours.";
    case "no_phone_on_file":
      return "No phone number on file for this prospect.";
    case "send_failed":
      return "The gateway couldn't send this message.";
    default:
      return "Couldn't complete this action.";
  }
}

/**
 * docs/whatsapp-intelligence-architecture.md §8/§11/§14 WA-1/WA-3 — the
 * Prospect page's WhatsApp section: verify a number's real WhatsApp
 * reachability (never assumed from phoneClassification's rule-based
 * guess), then draft/edit/send a message. Every send is Level 0 — this
 * panel is the only place that calls POST .../whatsapp/send, and it
 * always sends exactly the text visible in the box, never anything
 * generated silently.
 */
export default function SendWhatsAppPanel({ prospect, onChanged }: { prospect: Prospect; onChanged?: () => void }) {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/crm/whatsapp/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => data.ok && setStatus(data));
  }, []);

  const phone = prospect.contactWhatsapp ?? prospect.contactPhone;

  async function verify() {
    setVerifying(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: data.status === "verified" ? "Verified — this number is on WhatsApp." : "Not found on WhatsApp." });
        onChanged?.();
      } else {
        setResult({ ok: false, message: describeFailure(data.reason) });
      }
    } catch {
      setResult({ ok: false, message: "Network error." });
    } finally {
      setVerifying(false);
    }
  }

  async function draft() {
    setDrafting(true);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id }),
      });
      const data = await res.json();
      if (data.ok) setMessage(data.draft);
      else setResult({ ok: false, message: "Couldn't generate a draft right now." });
    } catch {
      setResult({ ok: false, message: "Network error." });
    } finally {
      setDrafting(false);
    }
  }

  async function send() {
    if (!message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/crm/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id, message: message.trim() }),
      });
      const data = await res.json();
      if (typeof data.sentToday === "number") {
        setStatus((prev) => (prev ? { ...prev, sentToday: data.sentToday } : prev));
      }
      if (data.ok) {
        setResult({ ok: true, message: "Sent." });
        setMessage("");
        onChanged?.();
      } else {
        setResult({ ok: false, message: describeFailure(data.reason) });
      }
    } catch {
      setResult({ ok: false, message: "Network error — nothing was sent." });
    } finally {
      setSending(false);
    }
  }

  if (!phone) {
    return <div className="rounded-df-md border border-border bg-canvas p-3 text-xs text-muted">No phone number on file — add one to enable WhatsApp outreach.</div>;
  }

  const capReached = status ? status.sentToday >= status.cap : false;
  const verified = prospect.whatsappStatus === "verified" && Boolean(prospect.whatsappJid);

  return (
    <div className="card-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">WhatsApp</p>
        {status && (
          <span className="text-[11px] text-muted">
            {status.sentToday}/{status.cap} sent today
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full border px-2 py-0.5 font-medium ${
            prospect.whatsappStatus === "verified"
              ? "border-teal/40 bg-teal/10 text-teal"
              : prospect.whatsappStatus === "unavailable"
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-border bg-canvas text-muted"
          }`}
        >
          {prospect.whatsappStatus === "verified" ? "Verified on WhatsApp" : prospect.whatsappStatus === "unavailable" ? "Not on WhatsApp" : "Not yet verified"}
        </span>
        {prospect.whatsappVerifiedAt && <span className="text-muted">as of {new Date(prospect.whatsappVerifiedAt).toLocaleDateString()}</span>}
        {prospect.whatsappOptedOut && <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 font-medium text-danger">Opted out</span>}
        <button type="button" onClick={verify} disabled={verifying} className="btn-secondary ml-auto text-xs disabled:opacity-50">
          {verifying ? "Checking…" : "Verify number"}
        </button>
      </div>

      {status && !status.configured ? (
        <p className="mt-3 text-xs text-muted">
          The WhatsApp gateway isn&apos;t connected yet — see <code>whatsapp-service/README.md</code> for the one-time setup (linking a real
          WhatsApp Business number).
        </p>
      ) : prospect.whatsappOptedOut ? (
        <p className="mt-3 text-xs text-muted">This prospect opted out — outreach is permanently blocked.</p>
      ) : !verified ? (
        <p className="mt-3 text-xs text-muted">Verify this number is on WhatsApp before drafting a message.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted">Message</p>
            <button type="button" onClick={draft} disabled={drafting} className="text-[11px] text-teal hover:underline disabled:opacity-50">
              {drafting ? "Drafting…" : "AI draft"}
            </button>
          </div>
          <div className="mt-1">
            <ChatInput value={message} onChange={setMessage} placeholder="Type or AI-draft a message…" minRows={2} maxRows={8} />
          </div>
          <button
            type="button"
            onClick={send}
            disabled={sending || capReached || !message.trim()}
            className="btn-primary mt-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "Sending…" : capReached ? "Daily cap reached" : "Send"}
          </button>
        </>
      )}

      {result && <p className={`mt-2 text-xs ${result.ok ? "text-teal" : "text-danger"}`}>{result.message}</p>}
    </div>
  );
}
