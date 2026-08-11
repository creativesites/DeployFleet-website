"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

interface GeographyCityRow {
  city: string;
  visitorCount: number;
  sessionCount: number;
  avgEngagement: number;
  highIntentCount: number;
}

interface GeographyCountryRow {
  country: string;
  countryCode: string | null;
  visitorCount: number;
  sessionCount: number;
  avgEngagement: number;
  highIntentCount: number;
  demoRequestCount: number;
  cities: GeographyCityRow[];
}

type RangeKey = "today" | "7d" | "30d" | "90d" | "all";

const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

/** Spec §16's Today/7d/30d/90d/All selector, computed client-side into an ISO "since" cutoff. */
function sinceFor(range: RangeKey): string | null {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "today" ? 0 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const since = new Date(now);
  if (days === 0) {
    since.setHours(0, 0, 0, 0);
  } else {
    since.setDate(since.getDate() - days);
  }
  return since.toISOString();
}

export default function GeographyTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [rows, setRows] = useState<GeographyCountryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const since = useMemo(() => sinceFor(range), [range]);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    fetch(`/api/admin/analytics/geography?${params.toString()}`)
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
  }, [firebaseAdminConfigured, since]);

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see geography data.
        See <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load geography data ({error}).</p>;

  const totalVisitors = rows?.reduce((sum, r) => sum + r.visitorCount, 0) ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(RANGE_LABEL) as RangeKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setRange(key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              range === key ? "border-teal bg-teal/10 text-teal" : "border-border text-muted hover:text-navy"
            }`}
          >
            {RANGE_LABEL[key]}
          </button>
        ))}
      </div>

      {!rows ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No visitor location data for this range yet.</p>
      ) : (
        <>
          <p className="mt-4 text-xs text-muted">
            {totalVisitors} visitor{totalVisitors === 1 ? "" : "s"} across {rows.length} countr
            {rows.length === 1 ? "y" : "ies"} — no map visualization yet (would need a Google Maps API key); this
            table is deliberately the primary view, per spec §16&apos;s own preference for aggregated views over
            individual markers.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4 text-right">Visitors</th>
                  <th className="py-2 pr-4 text-right">Sessions</th>
                  <th className="py-2 pr-4 text-right">Avg engagement</th>
                  <th className="py-2 pr-4 text-right">High intent</th>
                  <th className="py-2 pr-4 text-right">Demo/contact requests</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.country}>
                    <tr
                      onClick={() => setExpandedCountry(expandedCountry === row.country ? null : row.country)}
                      className="cursor-pointer border-b border-border hover:bg-canvas"
                    >
                      <td className="py-2.5 pr-4 font-medium text-navy">
                        {row.country}
                        {row.countryCode && <span className="ml-1.5 text-xs text-muted">({row.countryCode})</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{row.visitorCount}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{row.sessionCount}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{row.avgEngagement}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{row.highIntentCount}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{row.demoRequestCount}</td>
                    </tr>
                    {expandedCountry === row.country &&
                      row.cities.map((city) => (
                        <tr key={`${row.country}-${city.city}`} className="border-b border-border bg-canvas text-xs text-muted">
                          <td className="py-2 pr-4 pl-6">{city.city}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{city.visitorCount}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{city.sessionCount}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{city.avgEngagement}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{city.highIntentCount}</td>
                          <td className="py-2 pr-4 text-right">—</td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
