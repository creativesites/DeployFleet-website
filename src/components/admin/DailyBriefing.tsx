"use client";

import { useEffect, useState } from "react";
import TeamBriefingBars from "./TeamBriefingBars";

interface Synthesis {
  date: string;
  narrative: string | null;
  fallbackText: string;
  aiUsed: boolean;
  counts: {
    entries: number;
    facts: number;
    tasks: number;
    decisions: number;
    risks: number;
    recommendations: number;
    competitors: number;
    decisionMakers: number;
    unansweredQuestions: number;
    timelineSignals: number;
    budgetSignals: number;
  };
  briefings: { submitted: number; total: number; completenessPct: number };
  whatsappAwaiting: number;
  generatedAt: string;
}

const CHIP_FIELDS: { key: keyof Synthesis["counts"]; label: string }[] = [
  { key: "facts", label: "facts" },
  { key: "risks", label: "risks" },
  { key: "recommendations", label: "recommendations" },
  { key: "competitors", label: "competitors" },
  { key: "decisionMakers", label: "decision-makers" },
  { key: "unansweredQuestions", label: "open questions" },
];

/**
 * Revenue OS RS-2 §5.6 — the Daily briefing on Today: the AI synthesis
 * narrative (deterministic fallback when AI is off) alongside the team
 * completeness bar. The narrative carries the AI-violet accent only when
 * it was genuinely AI-written, per the brand's reserved-violet convention.
 */
export default function DailyBriefing({ firebaseAdminConfigured }: { firebaseAdminConfigured: boolean }) {
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!firebaseAdminConfigured) return;
    let cancelled = false;
    fetch(`/api/admin/crm/daily-synthesis`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setSynthesis(data.synthesis);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [firebaseAdminConfigured]);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/crm/daily-synthesis?refresh=1`);
      const data = await res.json();
      if (data.ok) setSynthesis(data.synthesis);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }

  if (!firebaseAdminConfigured || failed) return null;

  const aiAccent = synthesis?.aiUsed;

  return (
    <section className="mb-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Synthesis */}
        <div
          className={`card-surface p-5 lg:col-span-2 ${aiAccent ? "border-ai-violet/30" : ""}`}
          style={aiAccent ? { background: "color-mix(in srgb, var(--df-ai-violet) 4%, var(--df-card))" } : undefined}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${aiAccent ? "text-ai-violet" : "text-muted"}`}>
                Daily briefing
              </p>
              {aiAccent && (
                <span className="rounded-full border border-ai-violet/40 bg-ai-violet/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai-violet">
                  AI synthesis
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="text-[11px] text-teal hover:underline disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {!synthesis ? (
            <p className="mt-3 text-sm text-muted">Loading…</p>
          ) : (
            <>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-body">
                {synthesis.narrative ?? synthesis.fallbackText}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {CHIP_FIELDS.filter((f) => synthesis.counts[f.key] > 0).map((f) => (
                  <span key={f.key} className="rounded-full border border-border bg-canvas px-2 py-0.5 text-[11px] text-body">
                    {synthesis.counts[f.key]} {f.label}
                  </span>
                ))}
                {synthesis.whatsappAwaiting > 0 && (
                  <span className="rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[11px] font-medium text-amber">
                    {synthesis.whatsappAwaiting} WhatsApp awaiting
                  </span>
                )}
              </div>
              {!synthesis.aiUsed && synthesis.counts.entries + synthesis.whatsappAwaiting > 0 && (
                <p className="mt-2 text-[11px] text-muted">
                  Showing the deterministic summary — connect an AI provider for the narrative version.
                </p>
              )}
            </>
          )}
        </div>

        {/* Team completeness */}
        <div className="lg:col-span-1">
          <TeamBriefingBars variant="compact" />
        </div>
      </div>
    </section>
  );
}
