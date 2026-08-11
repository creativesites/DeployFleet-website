"use client";

import { useEffect, useState } from "react";

interface DayScoreboard {
  date: string;
  attempts: number;
  meaningful: number;
}

interface WeeklyScoreboard {
  weekStart: string;
  days: DayScoreboard[];
  totalAttempts: number;
  totalMeaningful: number;
  targetAttemptsPerDay: number;
  targetMeaningfulPerDay: number;
}

function mostRecentMondayIso(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

function shiftWeek(weekStartIso: string, deltaWeeks: number): string {
  const d = new Date(`${weekStartIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return d.toISOString().slice(0, 10);
}

function weekdayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
}

/** Phase 0 §6.2 — the Sales Playbook's own "10 attempts, 5 meaningful interactions" daily benchmark, made visible as a weekly scoreboard. */
export default function TargetsTab({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [weekStart, setWeekStart] = useState(() => mostRecentMondayIso());
  const [scoreboard, setScoreboard] = useState<WeeklyScoreboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch(`/api/admin/crm/targets?weekStart=${weekStart}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setScoreboard(data.scoreboard);
        else setError(data.reason ?? "unknown_error");
      })
      .catch(() => {
        if (!cancelled) setError("network_error");
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured, weekStart]);

  if (!firebaseAdminConfigured) {
    return (
      <p className="rounded-df-md border border-border bg-canvas p-4 text-sm text-muted">
        Firebase Admin isn&apos;t configured yet — set <code>FIREBASE_ADMIN_PROJECT_ID</code>,{" "}
        <code>FIREBASE_ADMIN_CLIENT_EMAIL</code>, and <code>FIREBASE_ADMIN_PRIVATE_KEY</code> to see targets. See{" "}
        <code>.env.example</code>.
      </p>
    );
  }

  if (error) return <p className="text-sm text-danger">Couldn&apos;t load the scoreboard ({error}).</p>;

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
          className="btn-secondary text-sm"
          aria-label="Previous week"
        >
          ← Prev
        </button>
        <p className="text-sm font-medium text-navy">Week of {weekStart}</p>
        <button
          type="button"
          onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
          className="btn-secondary text-sm"
          aria-label="Next week"
        >
          Next →
        </button>
        {weekStart !== mostRecentMondayIso() && (
          <button type="button" onClick={() => setWeekStart(mostRecentMondayIso())} className="ml-auto text-xs text-teal hover:underline">
            Back to this week
          </button>
        )}
      </div>

      {!scoreboard ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Attempts this week</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{scoreboard.totalAttempts}</p>
              <p className="text-xs text-muted">Target {scoreboard.targetAttemptsPerDay * 7}</p>
            </div>
            <div className="card-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Meaningful this week</p>
              <p className="mt-1 text-2xl font-semibold text-navy">{scoreboard.totalMeaningful}</p>
              <p className="text-xs text-muted">Target {scoreboard.targetMeaningfulPerDay * 7}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-7">
            {scoreboard.days.map((d) => {
              const attemptsMet = d.attempts >= scoreboard.targetAttemptsPerDay;
              const meaningfulMet = d.meaningful >= scoreboard.targetMeaningfulPerDay;
              const isFuture = new Date(`${d.date}T00:00:00.000Z`) > new Date();
              return (
                <div key={d.date} className="card-surface p-3">
                  <p className="text-xs font-semibold text-navy">{weekdayLabel(d.date)}</p>
                  <p className="text-[11px] text-muted">{d.date}</p>
                  {isFuture ? (
                    <p className="mt-2 text-xs text-muted">—</p>
                  ) : (
                    <div className="mt-2 space-y-1 text-xs">
                      <p className={attemptsMet ? "font-medium text-teal" : "text-body"}>
                        {d.attempts}/{scoreboard.targetAttemptsPerDay} attempts
                      </p>
                      <p className={meaningfulMet ? "font-medium text-teal" : "text-body"}>
                        {d.meaningful}/{scoreboard.targetMeaningfulPerDay} meaningful
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
