"use client";

import { useEffect, useState } from "react";
import { engagementBand, intentCategory } from "@/lib/analytics/scoring";
import type { Visitor, VisitorEvent, VisitorSession } from "@/lib/visitorTypes";

interface TimelineEntry {
  kind: "session_start" | "session_end" | "event";
  timestamp: string;
  session?: VisitorSession;
  event?: VisitorEvent;
}

interface VisitorDetail {
  visitor: Visitor;
  sessions: VisitorSession[];
  timeline: TimelineEntry[];
}

const BAND_COLOR: Record<string, string> = {
  low: "var(--df-color-neutral-400, #9ca3af)",
  moderate: "#eab308",
  engaged: "#22c55e",
  "highly-engaged": "#0ea5e9",
  "high-intent": "#a855f7",
};

function ScoreBadge({ label, score, band }: { label: string; score: number; band: string }) {
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ borderColor: BAND_COLOR[band], color: BAND_COLOR[band] }}
      title={`${label}: ${score}/100`}
    >
      {label} {score}
    </span>
  );
}

export default function VisitorsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "anonymous" | "identified">("");
  const [minIntent, setMinIntent] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (minIntent) params.set("minIntentScore", minIntent);
    fetch(`/api/admin/visitors?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setVisitors(data.visitors);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured, statusFilter, minIntent]);

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    const res = await fetch(`/api/admin/visitors/${id}`);
    const data = await res.json();
    if (data.ok) setDetail(data);
    setDetailLoading(false);
  }

  async function runBackfill() {
    setBackfillRunning(true);
    setBackfillResult(null);
    const res = await fetch("/api/admin/visitors/backfill", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      setBackfillResult(
        `Scanned ${data.result.pageviewsScanned} legacy pageviews — created ${data.result.visitorsCreated}, merged into ${data.result.visitorsMerged} existing visitors.`
      );
      // Refresh the list to reflect newly-backfilled visitors.
      setStatusFilter((s) => s);
    } else {
      setBackfillResult(`Backfill failed: ${data.reason ?? "unknown_error"}`);
    }
    setBackfillRunning(false);
  }

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see visitors. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load visitors ({error}).</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="visitor-status-filter" className="text-sm font-medium text-navy">
            Status
          </label>
          <select
            id="visitor-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | "anonymous" | "identified")}
            className="rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          >
            <option value="">All</option>
            <option value="anonymous">Anonymous</option>
            <option value="identified">Identified</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="visitor-intent-filter" className="text-sm font-medium text-navy">
            Min intent score
          </label>
          <input
            id="visitor-intent-filter"
            type="number"
            min={0}
            max={100}
            value={minIntent}
            onChange={(e) => setMinIntent(e.target.value)}
            placeholder="0"
            className="w-20 rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          />
        </div>
        <button
          type="button"
          onClick={runBackfill}
          disabled={backfillRunning}
          className="btn-secondary ml-auto text-sm disabled:opacity-50"
        >
          {backfillRunning ? "Running backfill…" : "Backfill legacy pageviews"}
        </button>
      </div>

      {backfillResult && <p className="mt-3 text-xs text-muted">{backfillResult}</p>}

      {!visitors ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : visitors.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No visitors yet — once traffic flows through the site (or after running the backfill above), visitors will
          appear here.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {visitors.map((v) => {
            const eBand = engagementBand(v.engagementScore);
            const iCategory = intentCategory(v.intentScore);
            return (
              <div key={v.id} className="card-surface p-4">
                <button type="button" onClick={() => toggleExpand(v.id)} className="w-full text-left">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy">
                        {v.status === "identified" ? `Lead ${v.leadId?.slice(0, 8)}` : `Visitor ${v.id.slice(0, 8)}`}
                      </p>
                      <p className="text-sm text-body">
                        {[v.city, v.country].filter(Boolean).join(", ") || "Unknown location"} ·{" "}
                        {v.deviceType !== "unknown" ? v.deviceType : "Unknown device"}
                      </p>
                      <p className="text-sm text-muted">
                        {v.totalSessions} session{v.totalSessions === 1 ? "" : "s"} · {v.totalPageViews} page view
                        {v.totalPageViews === 1 ? "" : "s"} · last seen {new Date(v.lastSeenAt).toLocaleString()}
                      </p>
                      {v.mostViewedPage && <p className="mt-1 text-xs text-muted">Top page: {v.mostViewedPage}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <ScoreBadge label="Engagement" score={v.engagementScore} band={eBand} />
                      <ScoreBadge label="Intent" score={v.intentScore} band={iCategory === "sales-ready" || iCategory === "high-intent" ? "high-intent" : iCategory === "interested" ? "engaged" : iCategory === "warm" ? "moderate" : "low"} />
                      {v.lastReferrerType !== "unknown" && (
                        <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                          {v.lastReferrerType.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {expandedId === v.id && (
                  <div className="mt-4 border-t border-border pt-4">
                    {detailLoading && <p className="text-sm text-muted">Loading timeline…</p>}
                    {detail && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Timeline ({detail.timeline.length} entries)
                        </p>
                        <div className="max-h-80 space-y-1.5 overflow-y-auto">
                          {detail.timeline.length === 0 && <p className="text-sm text-muted">No activity recorded yet.</p>}
                          {detail.timeline.map((entry, idx) => (
                            <div key={idx} className="flex items-baseline gap-2 text-xs">
                              <span className="w-36 shrink-0 text-muted">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                              <span className="text-navy">
                                {entry.kind === "session_start" && "Session started"}
                                {entry.kind === "session_end" && "Session ended"}
                                {entry.kind === "event" &&
                                  `${entry.event?.eventType}${entry.event?.pagePath ? ` — ${entry.event.pagePath}` : ""}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
