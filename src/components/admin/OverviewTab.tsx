"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  pageviews: {
    totalAllTime: number;
    last7Days: number;
    last30Days: number;
    uniqueVisitorsLast30Days: number;
    topPaths: { path: string; count: number }[];
  };
  leads: {
    totalAllTime: number;
    byStatus: { status: string; count: number }[];
  };
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  "demo-booked": "Demo booked",
  customer: "Customer",
  lost: "Lost",
};

export default function OverviewTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setStats(data);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured]);

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to enable visitor
        stats and leads. See <code>.env.example</code>.
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-danger">Couldn&apos;t load stats ({error}).</p>;
  }

  if (!stats) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const cards = [
    { label: "Pageviews, all time", value: stats.pageviews.totalAllTime },
    { label: "Pageviews, last 7 days", value: stats.pageviews.last7Days },
    { label: "Unique visitors, last 30 days", value: stats.pageviews.uniqueVisitorsLast30Days },
    { label: "Leads, all time", value: stats.leads.totalAllTime },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-df-md border border-border bg-canvas p-4 text-sm text-body">
        Winston&apos;s daily command center — directive, targets, the Orchestrator, and the prospect queue — now lives on{" "}
        <Link href="/admin/today" className="font-medium text-teal hover:underline">
          Today
        </Link>
        . This page stays focused on website visitor &amp; lead analytics.
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card-surface p-5">
            <p className="text-2xl font-bold text-navy">{c.value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted">{c.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy">Leads by status</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.leads.byStatus.map((s) => (
            <span
              key={s.status}
              className="rounded-full border border-border bg-canvas px-3 py-1.5 text-xs font-medium text-body"
            >
              {STATUS_LABEL[s.status] ?? s.status}: <strong className="text-navy">{s.count}</strong>
            </span>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy">Top pages, last 30 days</h2>
        <div className="mt-3 space-y-1.5">
          {stats.pageviews.topPaths.length === 0 && (
            <p className="text-sm text-muted">No pageviews logged yet.</p>
          )}
          {stats.pageviews.topPaths.map((p) => (
            <div key={p.path} className="flex items-center justify-between text-sm">
              <span className="text-body">{p.path}</span>
              <span className="font-medium text-navy">{p.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
