"use client";

import { useCallback, useEffect, useState } from "react";
import type { Visitor } from "@/lib/visitorTypes";

const POLL_INTERVAL_MS = 15_000;

function agoLabel(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function RealtimeTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [visitors, setVisitors] = useState<Visitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastPolledAt, setLastPolledAt] = useState<Date | null>(null);

  const poll = useCallback(() => {
    fetch("/api/admin/analytics/realtime")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setVisitors(data.visitors);
          setLastPolledAt(new Date());
        } else {
          setError(data.reason ?? "unknown_error");
        }
      })
      .catch(() => setError("network_error"));
  }, []);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [firebaseAdminConfigured, poll]);

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see real-time
        activity. See <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load real-time data ({error}).</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Polls every 15s, not a live push feed — &quot;active&quot; means a heartbeat or event in the last 5
          minutes.
          {lastPolledAt && ` Last updated ${lastPolledAt.toLocaleTimeString()}.`}
        </p>
        <button type="button" onClick={poll} className="btn-secondary shrink-0 text-xs">
          Refresh now
        </button>
      </div>

      {!visitors ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : visitors.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No active visitors right now.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {visitors.map((v) => (
            <div key={v.id} className="card-surface flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {[v.city, v.country].filter(Boolean).join(", ") || "Unknown location"}
                  </p>
                  <p className="text-xs text-muted">
                    {v.deviceType !== "unknown" ? v.deviceType : "Unknown device"} ·{" "}
                    {v.lastReferrerType !== "unknown" ? v.lastReferrerType.replace("_", " ") : "Unknown source"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-navy">{v.lastPage ?? "—"}</p>
                <p className="text-xs text-muted">{agoLabel(v.lastSeenAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
