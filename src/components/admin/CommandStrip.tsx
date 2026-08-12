"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DAILY_GOAL_FIELDS,
  type DailyGoalSet,
  type Directive,
  type GoalsConfig,
  type Weekday,
} from "@/lib/crmTypes";

interface DayScoreboard {
  date: string;
  attempts: number;
  meaningful: number;
  prospects: number;
  calls: number;
  whatsapp: number;
  emails: number;
  demos: number;
}
interface WeeklyScoreboard {
  weekStart: string;
  days: DayScoreboard[];
  totalAttempts: number;
  totalMeaningful: number;
  goals: GoalsConfig;
  targetAttemptsPerDay: number;
  targetMeaningfulPerDay: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function mostRecentMondayIso(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}
function weekdayOf(iso: string): Weekday {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDay() as Weekday;
}
function resolveGoals(config: GoalsConfig, weekday: Weekday): DailyGoalSet {
  return { ...config.default, ...(config.overrides[weekday] ?? {}) };
}

/** A slim, brand-gradient progress bar; turns solid emerald once the target is met. */
function ProgressBar({ value, target }: { value: number; target: number }) {
  const met = target > 0 && value >= target;
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${pct}%`,
          background: met ? "var(--df-emerald)" : "var(--df-gradient-brand)",
        }}
      />
    </div>
  );
}

function GoalTile({ label, value, target, tracked }: { label: string; value: number | null; target: number; tracked: boolean }) {
  const met = tracked && value !== null && target > 0 && value >= target;
  return (
    <div className="rounded-df-md border border-border bg-canvas p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-body">{label}</span>
        {met && (
          <span className="text-emerald" aria-label="target met" title="Target met">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      {tracked ? (
        <>
          <p className="mt-1 text-lg font-semibold text-navy">
            {value ?? 0}
            <span className="text-sm font-normal text-muted"> / {target}</span>
          </p>
          <ProgressBar value={value ?? 0} target={target} />
        </>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold text-navy">
            {target}
            <span className="text-sm font-normal text-muted"> target</span>
          </p>
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted">Not auto-counted</p>
        </>
      )}
    </div>
  );
}

function DirectiveForm({ onCreated }: { onCreated: (d: Directive) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"standing" | "weekly">("standing");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/crm/directives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          weekOf: scope === "weekly" ? mostRecentMondayIso() : null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onCreated(data.directive);
        setTitle("");
        setBody("");
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-teal hover:underline">
        + Set a directive
      </button>
    );
  }

  return (
    <div className="rounded-df-md border border-border bg-canvas p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Directive title — e.g. “Win 3 fleets over 20 trucks this quarter”"
        className="w-full rounded-df-md border border-border bg-card px-3 py-2 text-sm text-navy outline-none focus:border-teal"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Context, constraints, or the explicit ask (optional)"
        className="mt-2 w-full rounded-df-md border border-border bg-card px-3 py-2 text-sm text-navy outline-none focus:border-teal"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-df-md border border-border text-xs">
          <button
            type="button"
            onClick={() => setScope("standing")}
            className={`px-3 py-1.5 ${scope === "standing" ? "bg-teal/10 font-medium text-teal" : "text-muted"}`}
          >
            Standing
          </button>
          <button
            type="button"
            onClick={() => setScope("weekly")}
            className={`px-3 py-1.5 ${scope === "weekly" ? "bg-teal/10 font-medium text-teal" : "text-muted"}`}
          >
            This week
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-navy">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim()}
            className="btn-primary text-xs disabled:opacity-40"
          >
            {saving ? "Saving…" : "Pin directive"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Revenue OS RS-0 §5.1–5.2 — the Command Strip: active CEO directives
 * pinned first, then this week's target progress, then today's per-goal
 * progress. Reads the editable GoalsConfig (via the weekly scoreboard) and
 * the directives collection; renders fully with zero AI involved.
 */
export default function CommandStrip({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [directives, setDirectives] = useState<Directive[] | null>(null);
  const [weekly, setWeekly] = useState<WeeklyScoreboard | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/crm/directives?status=active").then((r) => r.json()),
      fetch(`/api/admin/crm/targets?weekStart=${mostRecentMondayIso()}`).then((r) => r.json()),
    ])
      .then(([directivesData, targetsData]) => {
        if (cancelled) return;
        if (directivesData.ok) setDirectives(directivesData.directives);
        if (targetsData.ok) setWeekly(targetsData.scoreboard);
      })
      .catch(() => {
        if (!cancelled) {
          setDirectives([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured]);

  const today = todayIso();
  const todayDay = weekly?.days.find((d) => d.date === today) ?? null;
  const todayGoals = weekly ? resolveGoals(weekly.goals, weekdayOf(today)) : null;

  // Weekly targets: sum each of the 7 days' own resolved target, so
  // per-weekday overrides are reflected accurately rather than default×7.
  const weeklyTargets = useMemo(() => {
    if (!weekly) return null;
    let prospects = 0;
    let meaningful = 0;
    for (const d of weekly.days) {
      const g = resolveGoals(weekly.goals, weekdayOf(d.date));
      prospects += g.prospects;
      meaningful += g.meaningfulConversations;
    }
    return { prospects, meaningful };
  }, [weekly]);

  async function archive(id: string) {
    setArchiving(id);
    try {
      const res = await fetch(`/api/admin/crm/directives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await res.json();
      if (data.ok) setDirectives((prev) => (prev ?? []).filter((d) => d.id !== id));
    } finally {
      setArchiving(null);
    }
  }

  function countFor(key: keyof DailyGoalSet): number | null {
    if (!todayDay) return null;
    switch (key) {
      case "prospects":
        return todayDay.prospects;
      case "meaningfulConversations":
        return todayDay.meaningful;
      case "calls":
        return todayDay.calls;
      case "whatsapp":
        return todayDay.whatsapp;
      case "emails":
        return todayDay.emails;
      case "demos":
        return todayDay.demos;
      default:
        return null; // followUps / researchActions — no auto counter yet
    }
  }

  if (!firebaseAdminConfigured) return null;

  const todayLabel = new Date(`${today}T00:00:00.000Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <section className="mb-8 space-y-5">
      {/* Directives */}
      <div className="rounded-df-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Directive</p>
            <p className="mt-0.5 text-xs text-muted">What we&apos;re driving toward — {todayLabel}</p>
          </div>
          {directives && directives.length > 0 && <DirectiveForm onCreated={(d) => setDirectives((prev) => [d, ...(prev ?? [])])} />}
        </div>

        <div className="mt-4 space-y-3">
          {directives === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : directives.length === 0 ? (
            <div className="rounded-df-md border border-dashed border-border p-4">
              <p className="text-sm text-body">No directive pinned yet.</p>
              <p className="mt-1 text-xs text-muted">
                A directive is the one thing at the top of the day — the strategic priority every prospect decision
                traces back to.
              </p>
              <div className="mt-3">
                <DirectiveForm onCreated={(d) => setDirectives((prev) => [d, ...(prev ?? [])])} />
              </div>
            </div>
          ) : (
            directives.map((d) => (
              <div key={d.id} className="relative rounded-df-md border border-border bg-canvas p-4 pl-5">
                <span className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ background: "var(--df-gradient-brand)" }} aria-hidden="true" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-navy">{d.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          d.weekOf ? "bg-teal/10 text-teal" : "border border-border text-muted"
                        }`}
                      >
                        {d.weekOf ? `Week of ${d.weekOf}` : "Standing"}
                      </span>
                    </div>
                    {d.body && <p className="mt-1 whitespace-pre-wrap text-sm text-body">{d.body}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => archive(d.id)}
                    disabled={archiving === d.id}
                    className="shrink-0 text-xs text-muted hover:text-danger disabled:opacity-50"
                    title="Archive this directive"
                  >
                    {archiving === d.id ? "…" : "Archive"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Weekly + Today targets */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Weekly */}
        <div className="card-surface p-5 lg:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">This week</p>
          {weekly && weeklyTargets ? (
            <div className="mt-3 space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-body">Prospects worked</span>
                  <span className="text-sm font-semibold text-navy">
                    {weekly.totalAttempts}
                    <span className="font-normal text-muted"> / {weeklyTargets.prospects}</span>
                  </span>
                </div>
                <ProgressBar value={weekly.totalAttempts} target={weeklyTargets.prospects} />
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-body">Meaningful conversations</span>
                  <span className="text-sm font-semibold text-navy">
                    {weekly.totalMeaningful}
                    <span className="font-normal text-muted"> / {weeklyTargets.meaningful}</span>
                  </span>
                </div>
                <ProgressBar value={weekly.totalMeaningful} target={weeklyTargets.meaningful} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Loading…</p>
          )}
        </div>

        {/* Today */}
        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Today&apos;s goals</p>
            <a href="/admin/settings/daily-goals" className="text-[11px] text-teal hover:underline">
              Edit targets
            </a>
          </div>
          {todayGoals ? (
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {DAILY_GOAL_FIELDS.map(({ key, label, tracked }) => (
                <GoalTile key={key} label={label} value={countFor(key)} target={todayGoals[key]} tracked={tracked} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Loading…</p>
          )}
        </div>
      </div>
    </section>
  );
}
