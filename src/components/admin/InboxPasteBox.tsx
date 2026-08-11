"use client";

import { useState } from "react";
import {
  INBOX_SOURCE_TYPE_LABEL,
  type ExtractionResult,
  type InboxEntry,
  type InboxSourceType,
  type Prospect,
} from "@/lib/crmTypes";

/**
 * Phase 1 §7.1 — the AI Inbox's "paste everything" box. Shared across
 * three surfaces: a Prospect page's Employee Intelligence tab (both
 * relatedProspectId and relatedEmployeeId pre-fixed — every extracted
 * fact/task defaults straight to this prospect, no per-item resolution
 * needed), a Team page's employee tab (relatedEmployeeId fixed,
 * relatedProspectId not — facts/tasks need a per-item prospect-resolve
 * dropdown), and the dedicated /admin/inbox page (neither fixed).
 * Nothing here writes to facts/tasks/decisions until Winston explicitly
 * approves and hits "Apply approved" (§7.1 step 4 — review, not silent
 * apply).
 */

const SOURCE_TYPES: InboxSourceType[] = [
  "ai_sdr",
  "ai_researcher",
  "ai_sales_coach",
  "ai_market_intelligence",
  "ai_seo",
  "ai_content",
  "ai_analyst",
  "winston_direct",
  "call_transcript",
];

function resolveDefaultProspectId(prospectRef: string | null, fixedProspectId: string | null | undefined, prospects: Prospect[]): string {
  if (fixedProspectId) return fixedProspectId;
  if (!prospectRef) return "";
  const match = prospects.find((p) => p.name.toLowerCase() === prospectRef.toLowerCase());
  if (match) return match.id;
  const partial = prospects.find(
    (p) => p.name.toLowerCase().includes(prospectRef.toLowerCase()) || prospectRef.toLowerCase().includes(p.name.toLowerCase())
  );
  return partial?.id ?? "";
}

interface Props {
  relatedProspectId?: string | null;
  relatedEmployeeId?: string | null;
  defaultSourceType?: InboxSourceType;
  /** When true, hides the source-type picker (parent already knows, e.g. an employee's own tab defaults to that employee's natural source type). */
  lockSourceType?: boolean;
  onApplied?: () => void;
}

export default function InboxPasteBox({ relatedProspectId, relatedEmployeeId, defaultSourceType, lockSourceType, onApplied }: Props) {
  const [rawText, setRawText] = useState("");
  const [sourceType, setSourceType] = useState<InboxSourceType>(defaultSourceType ?? "winston_direct");
  const [submitting, setSubmitting] = useState(false);
  const [entry, setEntry] = useState<InboxEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [approvedFacts, setApprovedFacts] = useState<Set<number>>(new Set());
  const [approvedTasks, setApprovedTasks] = useState<Set<number>>(new Set());
  const [approvedDecisions, setApprovedDecisions] = useState<Set<number>>(new Set());
  const [factProspectIds, setFactProspectIds] = useState<Record<number, string>>({});
  const [taskProspectIds, setTaskProspectIds] = useState<Record<number, string>>({});
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const needsProspectResolution = !relatedProspectId;

  async function submit() {
    if (!rawText.trim()) return;
    setSubmitting(true);
    setError(null);
    setEntry(null);
    setApplyResult(null);
    try {
      const [res, prospectsList] = await Promise.all([
        fetch("/api/admin/crm/inbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, sourceType, relatedProspectId: relatedProspectId ?? null, relatedEmployeeId: relatedEmployeeId ?? null }),
        }),
        needsProspectResolution && !prospects ? fetch("/api/admin/crm/prospects").then((r) => r.json()) : Promise.resolve(null),
      ]);
      const data = await res.json();
      if (!data.ok && !data.entry) {
        setError(data.reason ?? "unknown_error");
        return;
      }
      const newEntry: InboxEntry = data.entry;
      setEntry(newEntry);
      if (prospectsList?.ok) setProspects(prospectsList.prospects);

      const result: ExtractionResult | null = newEntry.extractionResult;
      const pool: Prospect[] = prospectsList?.ok ? prospectsList.prospects : (prospects ?? []);
      if (result) {
        setApprovedFacts(new Set(result.facts.map((_, i) => i)));
        setApprovedTasks(new Set(result.tasks.map((_, i) => i)));
        setApprovedDecisions(new Set(result.decisions.map((_, i) => i)));
        setFactProspectIds(
          Object.fromEntries(result.facts.map((f, i) => [i, resolveDefaultProspectId(f.prospectRef, relatedProspectId, pool)]))
        );
        setTaskProspectIds(
          Object.fromEntries(result.tasks.map((t, i) => [i, resolveDefaultProspectId(t.prospectRef, relatedProspectId, pool)]))
        );
      }
    } catch {
      setError("network_error");
    } finally {
      setSubmitting(false);
    }
  }

  async function applyApproved() {
    if (!entry?.extractionResult) return;
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch(`/api/admin/crm/inbox/${entry.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facts: Array.from(approvedFacts)
            .map((index) => ({ index, prospectId: factProspectIds[index] }))
            .filter((f) => f.prospectId),
          tasks: Array.from(approvedTasks).map((index) => ({ index, prospectId: taskProspectIds[index] || null })),
          decisions: Array.from(approvedDecisions).map((index) => ({ index })),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setApplyResult(`Applied: ${data.createdFacts.length} fact(s), ${data.createdTasks.length} task(s), ${data.createdDecisions.length} decision(s).`);
        setRawText("");
        setEntry(null);
        onApplied?.();
      } else {
        setApplyResult(`Apply failed: ${data.reason ?? "unknown_error"}`);
      }
    } finally {
      setApplying(false);
    }
  }

  function toggle(set: Set<number>, setter: (s: Set<number>) => void, index: number) {
    const next = new Set(set);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setter(next);
  }

  const result = entry?.extractionResult;

  return (
    <div className="card-surface p-4">
      {!lockSourceType && (
        <div className="mb-2">
          <label htmlFor="inbox-source-type" className="text-xs font-medium text-navy">
            Source
          </label>
          <select
            id="inbox-source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as InboxSourceType)}
            className="mt-1 w-full rounded-df-md border border-border bg-canvas px-2 py-1.5 text-xs text-navy outline-none focus:border-teal sm:w-64"
          >
            {SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {INBOX_SOURCE_TYPE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      )}
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={4}
        placeholder="Paste a conversation, call transcript, WhatsApp export, or your own note…"
        className="w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
      />
      <button type="button" onClick={submit} disabled={submitting || !rawText.trim()} className="btn-primary mt-2 text-sm disabled:opacity-50">
        {submitting ? "Processing…" : "Process with AI"}
      </button>
      {error && <p className="mt-2 text-xs text-danger">Couldn&apos;t process this entry ({error}).</p>}

      {entry && !result && (
        <p className="mt-3 text-xs text-muted">
          {entry.extractionStatus === "failed" ? "AI extraction unavailable right now — nothing was saved yet, safe to try again." : "Saved, no structured extraction available."}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal">AI interpretation — review before applying</p>

          {result.facts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Facts</p>
              <div className="mt-1.5 space-y-1.5">
                {result.facts.map((f, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="checkbox" checked={approvedFacts.has(i)} onChange={() => toggle(approvedFacts, setApprovedFacts, i)} />
                    <span className="text-body">
                      <span className="font-medium text-navy">{f.key}:</span> {f.value}
                      {f.confidence !== null && <span className="text-muted"> ({f.confidence}% confidence)</span>}
                    </span>
                    {needsProspectResolution && (
                      <select
                        value={factProspectIds[i] ?? ""}
                        onChange={(e) => setFactProspectIds((prev) => ({ ...prev, [i]: e.target.value }))}
                        className="rounded-df-md border border-border bg-canvas px-1.5 py-1 text-[11px] text-navy outline-none focus:border-teal"
                      >
                        <option value="">— pick prospect —</option>
                        {(prospects ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tasks</p>
              <div className="mt-1.5 space-y-1.5">
                {result.tasks.map((t, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="checkbox" checked={approvedTasks.has(i)} onChange={() => toggle(approvedTasks, setApprovedTasks, i)} />
                    <span className="text-body">
                      {t.title}
                      {t.dueDate && <span className="text-muted"> (due {t.dueDate})</span>}
                    </span>
                    {needsProspectResolution && (
                      <select
                        value={taskProspectIds[i] ?? ""}
                        onChange={(e) => setTaskProspectIds((prev) => ({ ...prev, [i]: e.target.value }))}
                        className="rounded-df-md border border-border bg-canvas px-1.5 py-1 text-[11px] text-navy outline-none focus:border-teal"
                      >
                        <option value="">— no prospect —</option>
                        {(prospects ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.decisions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Decisions</p>
              <div className="mt-1.5 space-y-1.5">
                {result.decisions.map((d, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={approvedDecisions.has(i)}
                      onChange={() => toggle(approvedDecisions, setApprovedDecisions, i)}
                      className="mt-0.5"
                    />
                    <span className="text-body">
                      <span className="font-medium text-navy">{d.decisionText}</span> — {d.reason}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {result.risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Risks flagged</p>
              <ul className="mt-1 list-inside list-disc text-xs text-danger">
                {result.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommendations</p>
              <ul className="mt-1 list-inside list-disc text-xs text-body">
                {result.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {result.contradictions.length > 0 && (
            <div className="rounded-df-md border border-danger/30 bg-danger/5 p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-danger">Contradictions</p>
              {result.contradictions.map((c, i) => (
                <p key={i} className="mt-1 text-xs text-body">
                  <span className="font-medium text-navy">{c.field}:</span> was &ldquo;{c.existingValue}&rdquo;, now &ldquo;{c.newValue}&rdquo;
                </p>
              ))}
            </div>
          )}

          {result.callAnalysis && (
            <div className="rounded-df-md border border-teal/30 bg-teal/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal">Sales Coach feedback</p>
              {result.callAnalysis.whatWentWell.length > 0 && (
                <p className="mt-1.5 text-xs text-body">
                  <span className="font-medium text-navy">Went well:</span> {result.callAnalysis.whatWentWell.join("; ")}
                </p>
              )}
              {result.callAnalysis.missedOpportunities.length > 0 && (
                <p className="mt-1 text-xs text-body">
                  <span className="font-medium text-navy">Missed:</span> {result.callAnalysis.missedOpportunities.join("; ")}
                </p>
              )}
              {result.callAnalysis.objectionsRaised.length > 0 && (
                <p className="mt-1 text-xs text-body">
                  <span className="font-medium text-navy">Objections:</span> {result.callAnalysis.objectionsRaised.join("; ")}
                </p>
              )}
              {result.callAnalysis.recommendedNextQuestion && (
                <p className="mt-1 text-xs text-navy">
                  <span className="font-medium">Ask next:</span> &ldquo;{result.callAnalysis.recommendedNextQuestion}&rdquo;
                </p>
              )}
            </div>
          )}

          {(result.facts.length > 0 || result.tasks.length > 0 || result.decisions.length > 0) && (
            <button type="button" onClick={applyApproved} disabled={applying} className="btn-primary text-sm disabled:opacity-50">
              {applying ? "Applying…" : "Apply approved"}
            </button>
          )}
        </div>
      )}

      {applyResult && <p className="mt-2 text-xs text-muted">{applyResult}</p>}
    </div>
  );
}
