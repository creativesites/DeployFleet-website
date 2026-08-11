"use client";

import { useEffect, useState } from "react";
import {
  INTERACTION_OUTCOME_LABEL,
  INTERACTION_TYPE_LABEL,
  PIPELINE_STAGE_LABEL,
  PIPELINE_STAGES,
  PROSPECT_SOURCE_LABEL,
  type Interaction,
  type PipelineStage,
  type Prospect,
  type ProspectSource,
} from "@/lib/crmTypes";

export default function ProspectsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<"" | PipelineStage>("");
  const [sourceFilter, setSourceFilter] = useState<"" | ProspectSource>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Interaction[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (stageFilter !== "") params.set("stage", String(stageFilter));
    if (sourceFilter) params.set("source", sourceFilter);
    fetch(`/api/admin/crm/prospects?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setProspects(data.prospects);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured, stageFilter, sourceFilter]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setInteractions(null);
      return;
    }
    setExpandedId(id);
    setInteractions(null);
    const res = await fetch(`/api/admin/crm/prospects/${id}`);
    const data = await res.json();
    if (data.ok) setInteractions(data.interactions);
  }

  async function runSync() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/admin/crm/sync", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setSyncResult(
        `Outbound list: ${data.seed.created} added, ${data.seed.skipped} already there. Website leads: ${data.leads.promoted} promoted.`
      );
      setStageFilter((s) => s); // trigger a refetch
    } else {
      setSyncResult(`Sync failed: ${data.reason ?? "unknown_error"}`);
    }
    setSyncing(false);
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see prospects. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load prospects ({error}).</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="prospect-stage-filter" className="text-sm font-medium text-navy">
            Stage
          </label>
          <select
            id="prospect-stage-filter"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value === "" ? "" : (Number(e.target.value) as PipelineStage))}
            className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          >
            <option value="">All</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {PIPELINE_STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="prospect-source-filter" className="text-sm font-medium text-navy">
            Source
          </label>
          <select
            id="prospect-source-filter"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as "" | ProspectSource)}
            className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          >
            <option value="">All</option>
            {Object.entries(PROSPECT_SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={runSync} disabled={syncing} className="btn-secondary ml-auto text-sm disabled:opacity-50">
          {syncing ? "Syncing…" : "Seed outbound list + sync leads"}
        </button>
      </div>

      {syncResult && <p className="mt-3 text-xs text-muted">{syncResult}</p>}

      {!prospects ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : prospects.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No prospects yet — click &quot;Seed outbound list + sync leads&quot; above to import the 52-company
          outbound list and promote any un-promoted website leads.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {prospects.map((p) => (
            <div key={p.id} className="card-surface p-4">
              <button type="button" onClick={() => toggleExpand(p.id)} className="w-full text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-navy">{p.name}</p>
                    <p className="text-sm text-body">
                      {p.contactName ?? "No contact name"} {p.contactPhone ? `· ${p.contactPhone}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {PIPELINE_STAGE_LABEL[p.stage]} · {PROSPECT_SOURCE_LABEL[p.source]}
                      {p.nextActionDate && ` · next: ${p.nextActionDate}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.priorityScore !== null && (
                      <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium text-navy">
                        Priority {p.priorityScore}
                      </span>
                    )}
                    {p.visitorSnapshot && (
                      <span className="rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-[11px] font-medium text-teal">
                        Website-linked
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {expandedId === p.id && (
                <div className="mt-4 space-y-4 border-t border-border pt-4 text-sm">
                  {p.location && (
                    <p>
                      <span className="font-medium text-navy">Location:</span> <span className="text-body">{p.location}</span>
                    </p>
                  )}
                  {p.estimatedFleetSizeRaw && (
                    <p>
                      <span className="font-medium text-navy">Estimated fleet:</span>{" "}
                      <span className="text-body">{p.estimatedFleetSizeRaw}</span>
                    </p>
                  )}
                  {p.primaryPainRaw && (
                    <p>
                      <span className="font-medium text-navy">Primary pain:</span>{" "}
                      <span className="text-body">{p.primaryPainRaw}</span>
                    </p>
                  )}
                  {p.phoneClassification && (
                    <p className="text-xs text-muted">
                      Phone: {p.phoneClassification.type}
                      {p.phoneClassification.carrier ? ` (${p.phoneClassification.carrier})` : ""} — recommended{" "}
                      {p.phoneClassification.recommendedChannel}
                      {p.phoneClassification.patternAnomaly && " · pattern anomaly flagged"}
                    </p>
                  )}

                  {p.intelligence.summary && (
                    <div className="rounded-df-md border border-border bg-canvas p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">AI brief</p>
                      <p className="mt-1 text-body">{p.intelligence.summary.value}</p>
                      {p.intelligence.recommendedWedge && (
                        <p className="mt-1 text-navy">
                          <span className="font-medium">Wedge:</span> {p.intelligence.recommendedWedge.value}
                        </p>
                      )}
                    </div>
                  )}

                  {p.visitorSnapshot && (
                    <div className="rounded-df-md border border-teal/30 bg-teal/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal">Website activity (at promotion)</p>
                      <p className="mt-1 text-navy">
                        {p.visitorSnapshot.totalSessions} sessions · {p.visitorSnapshot.totalPageViews} page views ·
                        engagement {p.visitorSnapshot.engagementScore}/100 · intent {p.visitorSnapshot.intentScore}/100
                      </p>
                      {p.visitorSnapshot.topPages.length > 0 && (
                        <p className="mt-1 text-xs text-muted">Top pages: {p.visitorSnapshot.topPages.join(", ")}</p>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Interaction history</p>
                    {!interactions ? (
                      <p className="mt-2 text-muted">Loading…</p>
                    ) : interactions.length === 0 ? (
                      <p className="mt-2 text-muted">No interactions logged yet.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {interactions.map((i) => (
                          <div key={i.id} className="text-xs">
                            <span className="text-muted">{new Date(i.createdAt).toLocaleString()}</span>{" "}
                            <span className="font-medium text-navy">{INTERACTION_TYPE_LABEL[i.type]}</span>
                            {i.outcome && <span className="text-body"> — {INTERACTION_OUTCOME_LABEL[i.outcome]}</span>}
                            {i.rawNote && <p className="mt-0.5 text-body">&ldquo;{i.rawNote}&rdquo;</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
