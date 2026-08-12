"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface BriefingItem {
  employeeId: string;
  employeeName: string;
  role: string;
  cadence: "daily" | "weekly";
  requiredInput: string;
  expectedByHour: number | null;
  periodKey: string;
  submitted: boolean;
  sourceInboxEntryId: string | null;
}
interface BriefingReport {
  items: BriefingItem[];
  submittedCount: number;
  totalCount: number;
  completenessPct: number;
  dailyPeriodKey: string;
  weeklyPeriodKey: string;
}

function completenessColor(pct: number): string {
  if (pct >= 100) return "var(--df-emerald)";
  if (pct >= 50) return "var(--df-gradient-brand)";
  return "var(--df-amber)";
}

/**
 * Revenue OS RS-2 §5.3–5.4 — the Daily AI Team Briefing completeness bars.
 * `full` on the Team page (per-worker rows), `compact` on Today (a single
 * headline + who's outstanding). Never blocks anything: if the report
 * can't load, it renders nothing rather than an error.
 */
export default function TeamBriefingBars({ variant = "full" }: { variant?: "full" | "compact" }) {
  const [report, setReport] = useState<BriefingReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/crm/team/briefing-status")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setReport(data.report);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;
  if (!report) {
    return variant === "compact" ? null : <p className="text-sm text-muted">Loading team briefing status…</p>;
  }
  if (report.totalCount === 0) {
    return variant === "compact" ? null : (
      <p className="rounded-df-md border border-dashed border-border p-4 text-sm text-muted">
        No worker has a required briefing configured yet. Open a worker on the Team list and set a daily or weekly
        required input to track submission completeness here.
      </p>
    );
  }

  const outstanding = report.items.filter((i) => !i.submitted);

  if (variant === "compact") {
    return (
      <div className="card-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Team intelligence</p>
          <span className="text-sm font-semibold text-navy">{report.completenessPct}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${report.completenessPct}%`, background: completenessColor(report.completenessPct) }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {outstanding.length === 0 ? (
            <span className="font-medium text-emerald">All required briefings are in.</span>
          ) : (
            <>
              Awaiting {outstanding.map((o) => `${o.employeeName} (${o.cadence})`).join(", ")}.{" "}
              <Link href="/admin/team" className="text-teal hover:underline">
                Open Team
              </Link>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-navy">Team intelligence completeness</h2>
          <p className="mt-0.5 text-xs text-muted">
            {report.submittedCount} of {report.totalCount} required briefings submitted for their current period.
          </p>
        </div>
        <span className="text-2xl font-bold text-navy">{report.completenessPct}%</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${report.completenessPct}%`, background: completenessColor(report.completenessPct) }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {report.items.map((item) => (
          <Link
            key={`${item.employeeId}-${item.cadence}`}
            href={`/admin/team/${item.employeeId}`}
            className="flex items-center justify-between gap-3 rounded-df-md border border-border bg-canvas p-3 hover:border-teal/50"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-navy">{item.employeeName}</span>
                <span className="text-xs text-muted">{item.role}</span>
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {item.cadence}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">{item.requiredInput}</p>
            </div>
            {item.submitted ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Submitted
              </span>
            ) : (
              <span className="shrink-0 text-xs font-medium text-amber">
                Awaiting{item.expectedByHour !== null ? ` · by ${String(item.expectedByHour).padStart(2, "0")}:00` : ""}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
