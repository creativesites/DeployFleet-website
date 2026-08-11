"use client";

import { useEffect, useState } from "react";

interface CampaignRow {
  channel: string;
  sessions: number;
  visitors: number;
  engagedSessions: number;
  highIntentVisitors: number;
  conversions: number;
  conversionRate: number | null;
}

interface FunnelSummary {
  totalVisitors: number;
  visitorsWithSession: number;
  engagedVisitors: number;
  convertedVisitors: number;
  identifiedVisitors: number;
}

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-navy">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-canvas">
        <div className="h-2 rounded-full bg-teal" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function CampaignsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [funnel, setFunnel] = useState<FunnelSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch("/api/admin/analytics/campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setRows(data.rows);
          setFunnel(data.funnel);
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

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see campaign data.
        See <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load campaign data ({error}).</p>;
  if (!rows || !funnel) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold text-navy">Funnel</h2>
        <p className="mt-1 text-xs text-muted">Visitors → had a session → engaged → converted → became a lead.</p>
        <div className="mt-4 space-y-3">
          <FunnelBar label="Total visitors" value={funnel.totalVisitors} max={funnel.totalVisitors} />
          <FunnelBar label="Had a session" value={funnel.visitorsWithSession} max={funnel.totalVisitors} />
          <FunnelBar label="Engaged (score ≥ 40)" value={funnel.engagedVisitors} max={funnel.totalVisitors} />
          <FunnelBar label="Converted (any CTA)" value={funnel.convertedVisitors} max={funnel.totalVisitors} />
          <FunnelBar label="Became a lead" value={funnel.identifiedVisitors} max={funnel.totalVisitors} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-navy">Channels</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No session data yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4">Channel</th>
                  <th className="py-2 pr-4 text-right">Sessions</th>
                  <th className="py-2 pr-4 text-right">Visitors</th>
                  <th className="py-2 pr-4 text-right">Engaged</th>
                  <th className="py-2 pr-4 text-right">High intent</th>
                  <th className="py-2 pr-4 text-right">Conversions</th>
                  <th className="py-2 pr-4 text-right">Conv. rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.channel} className="border-b border-border hover:bg-canvas">
                    <td className="py-2.5 pr-4 font-medium capitalize text-navy">{row.channel.replace(/_/g, " ")}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{row.sessions}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{row.visitors}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{row.engagedSessions}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{row.highIntentVisitors}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{row.conversions}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{pct(row.conversionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
