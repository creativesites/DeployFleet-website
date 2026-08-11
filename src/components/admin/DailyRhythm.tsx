"use client";

import { useEffect, useRef, useState } from "react";
import { useDailyRhythm } from "@/lib/useDailyRhythm";
import { TASK_INCOMPLETE_REASON_LABEL, type Task, type TaskIncompleteReason } from "@/lib/crmTypes";

/**
 * Phase 3 §9 — the anti-procrastination engine's three touchpoints, all
 * surfaced inline on the Command Center (no delivery channel exists —
 * see the architecture doc §12 — so "nudge" always means a card here,
 * never a notification). Deliberately not modal or literally blocking:
 * closing the tab is always possible, but each piece re-appears on the
 * next Command Center load that same day until dismissed/completed, per
 * this system's own stated "pushy, not unaccountable" design goal.
 *
 * Procrastination-pattern detection (the doc's own fourth item) is
 * explicitly NOT built here — the doc itself says it "needs weeks of
 * [end-of-day classification] data to have anything to learn from" and
 * is "not scoped further in this document." Nothing to build yet.
 */

interface SystemStateLite {
  todayAttempts: number;
  targetAttemptsPerDay: number;
  todayMeaningful: number;
  targetMeaningfulPerDay: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MIDDAY_HOUR = 12;
const EVENING_HOUR = 17;

export default function DailyRhythm({ state }: { state: SystemStateLite | null }) {
  const { morningBriefDate, middayNudgeDate, eodReviewDate, markMorningBriefShown, markMiddayNudgeShown, markEodReviewComplete } = useDailyRhythm();

  // A one-time snapshot at mount, computed during render (not in an
  // effect) — the same "reset state during render" pattern already used
  // elsewhere in this project instead of a synchronous setState-in-effect.
  const [hour] = useState(() => new Date().getHours());
  const today = todayIso();

  // --- Morning brief ---------------------------------------------------
  const [briefText, setBriefText] = useState<string | null>(null);
  const [briefDismissed, setBriefDismissed] = useState(false);
  const shouldFetchBrief = morningBriefDate !== today;
  const briefFetchStarted = useRef(false);

  useEffect(() => {
    if (!shouldFetchBrief || briefFetchStarted.current) return;
    briefFetchStarted.current = true;
    fetch("/api/admin/crm/orchestrator/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Give me my morning brief for today — use generate_daily_brief and tell me plainly what matters most right now." }),
    })
      .then((res) => res.json())
      .then((data) => {
        setBriefText(
          data.ok && data.text
            ? data.text
            : state
              ? `Today's target: ${state.targetAttemptsPerDay} attempts, ${state.targetMeaningfulPerDay} meaningful interactions. Check Today for who's due.`
              : "Check Today for who's due, and Targets for the week's pace."
        );
        markMorningBriefShown(today);
      })
      .catch(() => {
        setBriefText("Check Today for who's due, and Targets for the week's pace.");
        markMorningBriefShown(today);
      });
  }, [shouldFetchBrief, state, today, markMorningBriefShown]);

  const showMorningBrief = shouldFetchBrief && !briefDismissed;

  // --- Midday nudge ------------------------------------------------------
  const showMiddayNudge =
    hour >= MIDDAY_HOUR &&
    hour < EVENING_HOUR &&
    middayNudgeDate !== today &&
    state !== null &&
    state.todayAttempts < state.targetAttemptsPerDay / 2;

  // --- End-of-day review ---------------------------------------------------
  const showEodReview = hour >= EVENING_HOUR && eodReviewDate !== today;
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [reasons, setReasons] = useState<Record<string, TaskIncompleteReason | "">>({});
  const [completingReview, setCompletingReview] = useState(false);

  useEffect(() => {
    if (!showEodReview || tasks !== null) return;
    fetch("/api/admin/crm/tasks")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setTasks(data.tasks);
      });
  }, [showEodReview, tasks]);

  const incompleteToday = (tasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled" && t.dueDate !== null && t.dueDate <= today);
  const allClassified = incompleteToday.every((t) => reasons[t.id] || t.incompleteReason);

  async function completeReview() {
    setCompletingReview(true);
    try {
      for (const t of incompleteToday) {
        const reason = reasons[t.id];
        if (reason && reason !== t.incompleteReason) {
          await fetch(`/api/admin/crm/tasks/${t.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ incompleteReason: reason }),
          });
        }
      }
      markEodReviewComplete(today);
    } finally {
      setCompletingReview(false);
    }
  }

  if (!showMorningBrief && !showMiddayNudge && !showEodReview) return null;

  return (
    <div className="mb-6 space-y-3">
      {showMorningBrief && (
        <div
          className="rounded-df-lg border p-4"
          style={{
            borderColor: "color-mix(in srgb, var(--df-ai-violet, #a855f7) 22%, var(--df-border))",
            background: "color-mix(in srgb, var(--df-ai-violet, #a855f7) 4%, var(--df-card))",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--df-ai-violet, #a855f7)" }}>
                Morning Brief
              </p>
              {briefText === null ? (
                <p className="mt-1.5 text-sm text-muted">Preparing your brief…</p>
              ) : (
                <p className="mt-1.5 text-sm leading-relaxed text-body">{briefText}</p>
              )}
            </div>
            <button type="button" onClick={() => setBriefDismissed(true)} aria-label="Dismiss" className="shrink-0 text-muted hover:text-navy">
              ✕
            </button>
          </div>
        </div>
      )}

      {showMiddayNudge && state && (
        <div className="flex items-center justify-between gap-3 rounded-df-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-navy">
          <span>
            It&apos;s past midday and you&apos;re at {state.todayAttempts}/{state.targetAttemptsPerDay} attempts today — worth carving out time for
            outbound before the day gets away.
          </span>
          <button type="button" onClick={() => markMiddayNudgeShown(today)} aria-label="Dismiss" className="shrink-0 text-navy/60 hover:text-navy">
            ✕
          </button>
        </div>
      )}

      {showEodReview && (
        <div className="card-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">End-of-day review</p>
          {state && (
            <p className="mt-1.5 text-sm text-body">
              Today: {state.todayAttempts}/{state.targetAttemptsPerDay} attempts, {state.todayMeaningful}/{state.targetMeaningfulPerDay} meaningful
              interactions.
            </p>
          )}

          {tasks === null ? (
            <p className="mt-3 text-sm text-muted">Loading today&apos;s tasks…</p>
          ) : incompleteToday.length === 0 ? (
            <>
              <p className="mt-3 text-sm text-muted">Nothing due today is still open — nice work.</p>
              <button type="button" onClick={() => markEodReviewComplete(today)} className="btn-secondary mt-3 text-sm">
                Mark reviewed
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-body">
                {incompleteToday.length} task{incompleteToday.length === 1 ? "" : "s"} due today {incompleteToday.length === 1 ? "is" : "are"} still
                open — a quick reason for each before closing out the day:
              </p>
              <div className="mt-2 space-y-2">
                {incompleteToday.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-df-md border border-border bg-canvas p-2.5 text-xs">
                    <span className="text-navy">{t.title}</span>
                    <select
                      value={reasons[t.id] ?? t.incompleteReason ?? ""}
                      onChange={(e) => setReasons((prev) => ({ ...prev, [t.id]: e.target.value as TaskIncompleteReason }))}
                      className="rounded-df-md border border-border bg-card px-2 py-1 text-xs text-navy outline-none focus:border-teal"
                    >
                      <option value="">— why? —</option>
                      {Object.entries(TASK_INCOMPLETE_REASON_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={completeReview}
                disabled={!allClassified || completingReview}
                className="btn-primary mt-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {completingReview ? "Saving…" : !allClassified ? "Classify every task above first" : "Complete review"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
