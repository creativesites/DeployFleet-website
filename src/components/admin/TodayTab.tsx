"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  INTERACTION_OUTCOME_LABEL,
  PIPELINE_STAGE_LABEL,
  PIPELINE_STAGES,
  type InteractionOutcome,
  type InteractionType,
  type PipelineStage,
  type Prospect,
} from "@/lib/crmTypes";

const OUTCOME_ORDER: InteractionOutcome[] = [
  "no-answer",
  "gatekeeper",
  "wrong-person",
  "right-person",
  "meaningful-conversation",
  "demo-booked",
  "other",
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function whatsappHrefFor(prospect: Prospect): string | null {
  const number = prospect.contactWhatsapp ?? prospect.contactPhone;
  if (!number) return null;
  const digits = number.replace(/[^0-9]/g, "");
  const message = encodeURIComponent(
    `Hi, this is DeployFleet calling for ${prospect.contactName ?? prospect.name}. Do you have a moment?`
  );
  return `https://wa.me/${digits}?text=${message}`;
}

interface Extraction {
  stage: PipelineStage | null;
  pain: string | null;
  nextActionDate: string | null;
  nextActionType: InteractionType | null;
}

function ProspectCard({ prospect, onLogged }: { prospect: Prospect; onLogged: (id: string) => void }) {
  const [briefState, setBriefState] = useState<"idle" | "loading" | "unavailable">("idle");
  const [intelligence, setIntelligence] = useState(prospect.intelligence);

  const [interactionType, setInteractionType] = useState<InteractionType | null>(null);
  const [outcome, setOutcome] = useState<InteractionOutcome | null>(null);
  const [note, setNote] = useState("");
  const [parsing, setParsing] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [stage, setStage] = useState<PipelineStage>(prospect.stage);
  const [nextActionDate, setNextActionDate] = useState(prospect.nextActionDate ?? "");
  const [nextActionType, setNextActionType] = useState<InteractionType>(prospect.nextActionType ?? "call");
  const [logging, setLogging] = useState(false);
  const [done, setDone] = useState(false);

  async function prepareMe() {
    setBriefState("loading");
    try {
      const res = await fetch(`/api/admin/crm/prospects/${prospect.id}/brief`, { method: "POST" });
      const data = await res.json();
      if (data?.ok) {
        setIntelligence((prev) => ({ ...prev, ...data.intelligence }));
        setBriefState("idle");
      } else {
        setBriefState("unavailable");
      }
    } catch {
      setBriefState("unavailable");
    }
  }

  async function parseNote() {
    if (!note.trim()) return;
    setParsing(true);
    try {
      const res = await fetch(`/api/admin/crm/prospects/${prospect.id}/parse-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, rawNote: note }),
      });
      const data = await res.json();
      if (data?.ok) {
        setExtraction(data.extraction);
        if (data.extraction.stage !== null) setStage(data.extraction.stage);
        if (data.extraction.nextActionDate !== null) setNextActionDate(data.extraction.nextActionDate);
        if (data.extraction.nextActionType !== null) setNextActionType(data.extraction.nextActionType);
      }
    } finally {
      setParsing(false);
    }
  }

  async function logAndConfirm() {
    if (!interactionType || !outcome) return;
    setLogging(true);
    try {
      await fetch(`/api/admin/crm/prospects/${prospect.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: interactionType,
          outcome,
          rawNote: note || null,
          aiExtracted: extraction,
          createdBy: "Winston",
        }),
      });
      await fetch(`/api/admin/crm/prospects/${prospect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          nextActionDate: nextActionDate || null,
          nextActionType,
          nextActionNote: extraction?.pain ?? prospect.nextActionNote ?? null,
        }),
      });
      setDone(true);
      onLogged(prospect.id);
    } finally {
      setLogging(false);
    }
  }

  const whatsappHref = whatsappHrefFor(prospect);
  const isOverdue = prospect.nextActionDate !== null && prospect.nextActionDate < todayIso();

  if (done) {
    return (
      <div className="card-surface flex items-center justify-between p-4 opacity-60">
        <p className="text-sm font-medium text-navy">{prospect.name}</p>
        <span className="text-xs text-muted">Logged — next: {nextActionDate || "not set"}</span>
      </div>
    );
  }

  return (
    <div className="card-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-navy">{prospect.name}</p>
          <p className="text-xs text-muted">
            {PIPELINE_STAGE_LABEL[prospect.stage]}
            {isOverdue && <span className="ml-2 font-semibold text-danger">Overdue</span>}
            {prospect.priorityScore !== null && <span className="ml-2">Priority {prospect.priorityScore}</span>}
            {" · "}
            <Link href={`/admin/prospects/${prospect.id}`} className="text-teal hover:underline">
              View full profile
            </Link>
          </p>
        </div>
        {prospect.visitorSnapshot && (
          <span className="rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-[11px] font-medium text-teal">
            Website: {prospect.visitorSnapshot.engagementScore}/100 engagement · {prospect.visitorSnapshot.intentScore}/100 intent
          </span>
        )}
      </div>

      {/* Why / brief */}
      <div className="mt-3 rounded-df-md border border-border bg-canvas p-3 text-sm">
        {intelligence.summary || intelligence.recommendedWedge ? (
          <>
            {intelligence.summary && <p className="text-body">{intelligence.summary.value}</p>}
            {intelligence.recommendedWedge && (
              <p className="mt-1 text-navy">
                <span className="font-medium">Wedge:</span> {intelligence.recommendedWedge.value}
              </p>
            )}
            {intelligence.discoveryQuestion && (
              <p className="mt-1 text-navy">
                <span className="font-medium">Ask:</span> &ldquo;{intelligence.discoveryQuestion.value}&rdquo;
              </p>
            )}
          </>
        ) : (
          <p className="text-muted">
            {prospect.primaryPainRaw ?? "No brief yet."}{" "}
            {briefState !== "loading" && (
              <button type="button" onClick={prepareMe} className="font-semibold text-teal">
                Prepare Me
              </button>
            )}
            {briefState === "loading" && <span className="text-muted">Thinking…</span>}
            {briefState === "unavailable" && <span className="block text-xs text-muted">AI brief unavailable right now.</span>}
          </p>
        )}
      </div>

      {/* Contact actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {prospect.contactPhone && (
          <a
            href={`tel:${prospect.contactPhone.replace(/[^0-9+]/g, "")}`}
            onClick={() => setInteractionType("call")}
            className="btn-primary text-sm"
          >
            Call
          </a>
        )}
        {whatsappHref && (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={() => setInteractionType("whatsapp")} className="btn-secondary text-sm">
            WhatsApp
          </a>
        )}
        {prospect.contactEmail && (
          <Link href={`/admin/prospects/${prospect.id}`} className="btn-secondary text-sm">
            Email
          </Link>
        )}
      </div>

      {/* Outcome */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">What happened?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OUTCOME_ORDER.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOutcome(o)}
              className={`rounded-full border px-2.5 py-1.5 text-xs font-medium ${
                outcome === o ? "border-teal bg-teal/10 text-teal" : "border-border text-body hover:border-teal/50"
              }`}
            >
              {INTERACTION_OUTCOME_LABEL[o]}
            </button>
          ))}
        </div>
      </div>

      {outcome && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div>
            <label htmlFor={`note-${prospect.id}`} className="text-xs font-semibold uppercase tracking-wide text-muted">
              Note
            </label>
            <textarea
              id={`note-${prospect.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What did they say? (optional, but powers the AI suggestion below)"
              className="mt-1.5 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
            />
            {note.trim() && (
              <button type="button" onClick={parseNote} disabled={parsing} className="mt-1.5 text-xs font-semibold text-teal disabled:opacity-50">
                {parsing ? "Thinking…" : "Suggest next step with AI"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(Number(e.target.value) as PipelineStage)}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-2 py-1.5 text-xs text-navy outline-none focus:border-teal"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {PIPELINE_STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Next action date</label>
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-2 py-1.5 text-xs text-navy outline-none focus:border-teal"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Next action type</label>
              <select
                value={nextActionType}
                onChange={(e) => setNextActionType(e.target.value as InteractionType)}
                className="mt-1 w-full rounded-df-md border border-border bg-canvas px-2 py-1.5 text-xs text-navy outline-none focus:border-teal"
              >
                <option value="call">Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="visit">Depot visit</option>
                <option value="demo">Demo</option>
                <option value="note">Note</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={logAndConfirm}
            disabled={logging || !interactionType}
            className="btn-primary w-full text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {logging ? "Logging…" : !interactionType ? "Tap Call or WhatsApp above first" : "Confirm & Log"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TodayTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch(`/api/admin/crm/prospects?dueBy=${todayIso()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setProspects(
            [...data.prospects].sort((a: Prospect, b: Prospect) =>
              (a.nextActionDate ?? "") < (b.nextActionDate ?? "") ? -1 : 1
            )
          );
        } else {
          setError(data.reason ?? "unknown_error");
        }
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured]);

  function handleLogged() {
    // Cards flip to their own "done" state locally — no need to refetch the whole queue.
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see the queue. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load the queue ({error}).</p>;
  if (!prospects) return <p className="text-sm text-muted">Loading…</p>;

  if (prospects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing due today. Add prospects from the Prospects tab (seed the outbound list or sync website leads) to
        build out the queue.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {prospects.length} prospect{prospects.length === 1 ? "" : "s"} due today or overdue, oldest first.
      </p>
      {prospects.map((p) => (
        <ProspectCard key={p.id} prospect={p} onLogged={handleLogged} />
      ))}
    </div>
  );
}
