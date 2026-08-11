"use client";

import { useEffect, useState } from "react";

type ContentClassification =
  | "traffic-winner"
  | "engagement-winner"
  | "conversion-winner"
  | "high-bounce"
  | "low-traffic-high-conversion";

interface ContentPerformanceRow {
  pagePath: string;
  views: number;
  uniqueVisitors: number;
  sessionsAsLanding: number;
  bounceRate: number | null;
  avgEngagement: number | null;
  conversions: number;
  conversionRate: number | null;
  classifications: ContentClassification[];
}

const BADGE: Record<ContentClassification, { label: string; color: string }> = {
  "traffic-winner": { label: "Traffic winner", color: "#0ea5e9" },
  "engagement-winner": { label: "Engagement winner", color: "#22c55e" },
  "conversion-winner": { label: "Conversion winner", color: "#a855f7" },
  "high-bounce": { label: "High bounce", color: "#ef4444" },
  "low-traffic-high-conversion": { label: "Hidden gem", color: "#eab308" },
};

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export default function ContentTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [rows, setRows] = useState<ContentPerformanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch("/api/admin/analytics/content")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setRows(data.rows);
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
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see content
        performance. See <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load content performance ({error}).</p>;
  if (!rows) return <p className="text-sm text-muted">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">No page views recorded yet.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {(Object.keys(BADGE) as ContentClassification[]).map((key) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: BADGE[key].color }} />
            {BADGE[key].label}
          </span>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Page</th>
              <th className="py-2 pr-4 text-right">Views</th>
              <th className="py-2 pr-4 text-right">Unique visitors</th>
              <th className="py-2 pr-4 text-right">Bounce rate</th>
              <th className="py-2 pr-4 text-right">Avg engagement</th>
              <th className="py-2 pr-4 text-right">Conversions</th>
              <th className="py-2 pr-4 text-right">Conv. rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pagePath} className="border-b border-border hover:bg-canvas">
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-navy">{row.pagePath}</p>
                  {row.classifications.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {row.classifications.map((c) => (
                        <span
                          key={c}
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: `${BADGE[c].color}1a`, color: BADGE[c].color }}
                        >
                          {BADGE[c].label}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{row.views}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{row.uniqueVisitors}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{pct(row.bounceRate)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{row.avgEngagement ?? "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{row.conversions}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{pct(row.conversionRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        No SEO-opportunity classification yet — that needs organic-only traffic segmented per page, which would
        require every event to carry its session&apos;s referrer type (only sessions do today).
      </p>
    </div>
  );
}
