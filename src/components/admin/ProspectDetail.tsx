"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FACT_TYPE_LABEL,
  INTERACTION_OUTCOME_LABEL,
  INTERACTION_TYPE_LABEL,
  PIPELINE_STAGE_LABEL,
  PROSPECT_SOURCE_LABEL,
  type AiEmployee,
  type Fact,
  type Interaction,
  type Prospect,
} from "@/lib/crmTypes";
import InboxPasteBox from "./InboxPasteBox";
import SendEmailPanel from "./SendEmailPanel";
import SendWhatsAppPanel from "./SendWhatsAppPanel";
import ProspectContacts from "./ProspectContacts";

type TabKey = "overview" | "intelligence" | "employees" | "interactions" | "timeline";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "intelligence", label: "Intelligence" },
  { key: "employees", label: "Employee Intelligence" },
  { key: "interactions", label: "Interaction history" },
  { key: "timeline", label: "Timeline" },
];

interface TimelineEntry {
  kind: "interaction" | "fact" | "task" | "decision" | "audit_event";
  at: string;
  summary: string;
  detail: string | null;
}

/** Phase 1 §7.2 — the dedicated per-prospect page: header, then five tabs. Replaces the flat expand-in-place pattern on /admin/prospects for anything beyond a quick glance; that list page keeps its own preview for fast scanning. */
export default function ProspectDetail({ id }: { id: string }) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [employees, setEmployees] = useState<AiEmployee[] | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);

  const [editingRisk, setEditingRisk] = useState(false);
  const [riskFlagsInput, setRiskFlagsInput] = useState("");
  const [icpFitInput, setIcpFitInput] = useState("");
  const [opportunityInput, setOpportunityInput] = useState("");
  const [savingScores, setSavingScores] = useState(false);

  function loadProspect() {
    fetch(`/api/admin/crm/prospects/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setProspect(data.prospect);
          setInteractions(data.interactions);
          setRiskFlagsInput(data.prospect.riskFlags.join(", "));
          setIcpFitInput(data.prospect.icpFitScore?.toString() ?? "");
          setOpportunityInput(data.prospect.opportunityScore?.toString() ?? "");
        } else {
          setError(data.reason ?? "unknown_error");
        }
      })
      .catch(() => setError("network_error"));
  }

  useEffect(() => {
    loadProspect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === "intelligence" && !facts) {
      fetch(`/api/admin/crm/prospects/${id}/facts`)
        .then((res) => res.json())
        .then((data) => data.ok && setFacts(data.facts));
    }
    if (tab === "employees" && !employees) {
      fetch("/api/admin/crm/employees")
        .then((res) => res.json())
        .then((data) => data.ok && setEmployees(data.employees));
    }
    if (tab === "timeline" && !timeline) {
      fetch(`/api/admin/crm/prospects/${id}/timeline`)
        .then((res) => res.json())
        .then((data) => data.ok && setTimeline(data.entries));
    }
  }, [tab, id, facts, employees, timeline]);

  async function saveScores() {
    setSavingScores(true);
    try {
      await fetch(`/api/admin/crm/prospects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riskFlags: riskFlagsInput
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          icpFitScore: icpFitInput === "" ? null : Number(icpFitInput),
          opportunityScore: opportunityInput === "" ? null : Number(opportunityInput),
        }),
      });
      setEditingRisk(false);
      loadProspect();
    } finally {
      setSavingScores(false);
    }
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load this prospect ({error}).</p>;
  if (!prospect) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <Link href="/admin/prospects" className="text-xs text-teal hover:underline">
        ← All prospects
      </Link>

      {/* Header */}
      <div className="card-surface mt-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-navy">{prospect.name}</h1>
            <p className="mt-1 text-sm text-body">
              {PIPELINE_STAGE_LABEL[prospect.stage]} · {PROSPECT_SOURCE_LABEL[prospect.source]}
            </p>
            {prospect.nextActionDate && (
              <p className="mt-1 text-xs text-muted">
                Next action: {prospect.nextActionType ?? "—"} on {prospect.nextActionDate}
                {prospect.nextActionNote ? ` — ${prospect.nextActionNote}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {prospect.priorityScore !== null && (
              <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium text-navy">
                Priority {prospect.priorityScore}
              </span>
            )}
            {prospect.icpFitScore !== null && (
              <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium text-navy">
                ICP fit {prospect.icpFitScore}
              </span>
            )}
            {prospect.opportunityScore !== null && (
              <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium text-navy">
                Opportunity {prospect.opportunityScore}
              </span>
            )}
          </div>
        </div>

        {prospect.riskFlags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {prospect.riskFlags.map((flag) => (
              <span key={flag} className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                {flag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 border-t border-border pt-3">
          {!editingRisk ? (
            <button type="button" onClick={() => setEditingRisk(true)} className="text-xs text-teal hover:underline">
              Edit risk flags / ICP fit / opportunity score
            </button>
          ) : (
            <div className="space-y-2">
              <div>
                <label htmlFor="risk-flags" className="text-xs font-medium text-navy">
                  Risk flags (comma-separated)
                </label>
                <input
                  id="risk-flags"
                  value={riskFlagsInput}
                  onChange={(e) => setRiskFlagsInput(e.target.value)}
                  placeholder="e.g. no-decision-maker-identified, stalled-14-days"
                  className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="icp-fit" className="text-xs font-medium text-navy">
                    ICP fit (0-100)
                  </label>
                  <input
                    id="icp-fit"
                    type="number"
                    min={0}
                    max={100}
                    value={icpFitInput}
                    onChange={(e) => setIcpFitInput(e.target.value)}
                    className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
                  />
                </div>
                <div>
                  <label htmlFor="opportunity" className="text-xs font-medium text-navy">
                    Opportunity (0-100)
                  </label>
                  <input
                    id="opportunity"
                    type="number"
                    min={0}
                    max={100}
                    value={opportunityInput}
                    onChange={(e) => setOpportunityInput(e.target.value)}
                    className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-xs text-navy outline-none focus:border-teal"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={saveScores} disabled={savingScores} className="btn-primary text-xs disabled:opacity-50">
                  {savingScores ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditingRisk(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              tab === t.key ? "border-teal bg-teal/10 text-teal" : "border-border text-body hover:border-teal/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "overview" && (
          <div className="space-y-4">
          <div className="card-surface space-y-2 p-4 text-sm">
            {prospect.contactName && (
              <p>
                <span className="font-medium text-navy">Contact:</span> {prospect.contactName}
                {prospect.contactRole ? ` (${prospect.contactRole})` : ""}
              </p>
            )}
            {prospect.contactPhone && (
              <p>
                <span className="font-medium text-navy">Phone:</span> {prospect.contactPhone}
              </p>
            )}
            {prospect.contactEmail && (
              <p>
                <span className="font-medium text-navy">Email:</span> {prospect.contactEmail}
              </p>
            )}
            {prospect.location && (
              <p>
                <span className="font-medium text-navy">Location:</span> {prospect.location}
              </p>
            )}
            {prospect.estimatedFleetSizeRaw && (
              <p>
                <span className="font-medium text-navy">Estimated fleet:</span> {prospect.estimatedFleetSizeRaw}
              </p>
            )}
            {prospect.primaryPainRaw && (
              <p>
                <span className="font-medium text-navy">Primary pain:</span> {prospect.primaryPainRaw}
              </p>
            )}
            {prospect.phoneClassification && (
              <p className="text-xs text-muted">
                Phone: {prospect.phoneClassification.type}
                {prospect.phoneClassification.carrier ? ` (${prospect.phoneClassification.carrier})` : ""} — recommended{" "}
                {prospect.phoneClassification.recommendedChannel}
                {prospect.phoneClassification.patternAnomaly && " · pattern anomaly flagged"}
              </p>
            )}
            {prospect.visitorSnapshot && (
              <div className="rounded-df-md border border-teal/30 bg-teal/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal">Website activity (at promotion)</p>
                <p className="mt-1 text-navy">
                  {prospect.visitorSnapshot.totalSessions} sessions · {prospect.visitorSnapshot.totalPageViews} page views · engagement{" "}
                  {prospect.visitorSnapshot.engagementScore}/100 · intent {prospect.visitorSnapshot.intentScore}/100
                </p>
              </div>
            )}
          </div>

          <SendEmailPanel prospect={prospect} onSent={loadProspect} />
          <SendWhatsAppPanel prospect={prospect} onChanged={loadProspect} />
          <ProspectContacts prospectId={prospect.id} />
          </div>
        )}

        {tab === "intelligence" && (
          <div className="space-y-4">
            {(prospect.intelligence.summary || prospect.intelligence.recommendedWedge) && (
              <div className="card-surface p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current best answer</p>
                {prospect.intelligence.summary && <p className="mt-1 text-body">{prospect.intelligence.summary.value}</p>}
                {prospect.intelligence.recommendedWedge && (
                  <p className="mt-1 text-navy">
                    <span className="font-medium">Wedge:</span> {prospect.intelligence.recommendedWedge.value}
                  </p>
                )}
                {prospect.intelligence.discoveryQuestion && (
                  <p className="mt-1 text-navy">
                    <span className="font-medium">Ask:</span> &ldquo;{prospect.intelligence.discoveryQuestion.value}&rdquo;
                  </p>
                )}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Fact history</p>
              {!facts ? (
                <p className="mt-2 text-sm text-muted">Loading…</p>
              ) : facts.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No facts recorded yet — they accumulate from the AI Inbox and Winston&apos;s own notes.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {facts.map((f) => (
                    <div key={f.id} className={`card-surface p-3 text-xs ${f.status === "superseded" ? "opacity-50" : ""}`}>
                      <p className="text-navy">
                        <span className="font-medium">{f.key}:</span> {f.value}
                      </p>
                      <p className="mt-1 text-muted">
                        {FACT_TYPE_LABEL[f.factType]} · {f.source} · {f.status}
                        {f.confidence !== null && ` · ${f.confidence}% confidence`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "employees" && (
          <div className="space-y-4">
            {!employees ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : employees.length === 0 ? (
              <p className="text-sm text-muted">
                No AI employees yet — seed the workforce from the{" "}
                <Link href="/admin/team" className="text-teal hover:underline">
                  Team page
                </Link>
                .
              </p>
            ) : (
              employees.map((emp) => (
                <div key={emp.id}>
                  <p className="mb-1.5 text-sm font-semibold text-navy">
                    {emp.name} <span className="font-normal text-muted">— {emp.role}</span>
                  </p>
                  <InboxPasteBox relatedProspectId={prospect.id} relatedEmployeeId={emp.id} />
                </div>
              ))
            )}
          </div>
        )}

        {tab === "interactions" && (
          <div className="space-y-2">
            {interactions.length === 0 ? (
              <p className="text-sm text-muted">No interactions logged yet.</p>
            ) : (
              interactions.map((i) => (
                <div key={i.id} className="card-surface p-3 text-xs">
                  <span className="text-muted">{new Date(i.createdAt).toLocaleString()}</span>{" "}
                  <span className="font-medium text-navy">{INTERACTION_TYPE_LABEL[i.type]}</span>
                  {i.outcome && <span className="text-body"> — {INTERACTION_OUTCOME_LABEL[i.outcome]}</span>}
                  {i.rawNote && <p className="mt-0.5 text-body">&ldquo;{i.rawNote}&rdquo;</p>}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "timeline" && (
          <div className="space-y-2">
            {!timeline ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-muted">Nothing recorded yet.</p>
            ) : (
              timeline.map((entry, i) => (
                <div key={i} className="card-surface flex gap-3 p-3 text-xs">
                  <span className="w-16 shrink-0 text-muted">{new Date(entry.at).toLocaleDateString()}</span>
                  <div>
                    <p className="text-navy">
                      <span className="rounded-full border border-border bg-canvas px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                        {entry.kind}
                      </span>{" "}
                      {entry.summary}
                    </p>
                    {entry.detail && <p className="mt-0.5 text-body">{entry.detail}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
