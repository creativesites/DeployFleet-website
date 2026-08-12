"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_RANKING_WEIGHTS, RANKING_COMPONENT_META, type RankingWeights } from "@/lib/crmTypes";

export default function RankingWeightsTab() {
  const [loaded, setLoaded] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [weights, setWeights] = useState<RankingWeights>(DEFAULT_RANKING_WEIGHTS);
  const [saved, setSaved] = useState<RankingWeights | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/crm/ranking-weights")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        setWeights(data.weights);
        setSaved(data.weights);
        setPersistent(data.persistent);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(() => RANKING_COMPONENT_META.reduce((s, m) => s + (weights[m.key] || 0), 0), [weights]);
  const dirty = saved !== null && JSON.stringify(weights) !== JSON.stringify(saved);

  function setWeight(key: keyof RankingWeights, value: number) {
    setWeights((prev) => ({ ...prev, [key]: Math.max(0, Math.min(100, value)) }));
  }

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/crm/ranking-weights", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights }),
    });
    const data = await res.json();
    if (data.ok) {
      setSaved(data.weights);
      setPersistent(data.persistent);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
    }
    setSaving(false);
  }

  if (!loaded) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      {!persistent && (
        <div className="rounded-df-md border border-amber bg-[color-mix(in_srgb,var(--df-amber)_10%,transparent)] p-4 text-sm text-amber">
          Running on the in-memory fallback store — changes here will be lost on the next cold start/redeploy. Attach a
          Redis/KV integration in the Vercel dashboard to make edits durable.
        </div>
      )}

      <div className="rounded-df-md border border-border bg-canvas p-4 text-sm text-body">
        These weights drive the order of the <strong className="text-navy">Today</strong> queue. Each is a share of the
        final 0–100 score; they&apos;re normalized automatically, so they don&apos;t need to total 100. When an AI
        provider is configured it may re-rank the top candidates, but this deterministic order is always what ships.
      </div>

      {/* Effective distribution bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Effective distribution</span>
          <span>{total === 0 ? "even split" : `${total} total`}</span>
        </div>
        <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-border">
          {RANKING_COMPONENT_META.map((m, i) => {
            const share = total > 0 ? (weights[m.key] || 0) / total : 1 / RANKING_COMPONENT_META.length;
            return (
              <div
                key={m.key}
                title={`${m.label}: ${Math.round(share * 100)}%`}
                style={{
                  width: `${share * 100}%`,
                  background: `color-mix(in srgb, var(--df-teal) ${100 - i * 12}%, var(--df-cyan))`,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {RANKING_COMPONENT_META.map((m) => {
          const raw = weights[m.key] || 0;
          const share = total > 0 ? Math.round(((weights[m.key] || 0) / total) * 100) : Math.round((1 / RANKING_COMPONENT_META.length) * 100);
          return (
            <div key={m.key} className="card-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-navy">{m.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{m.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-navy tabular-nums">{share}%</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">of score</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={raw}
                  onChange={(e) => setWeight(m.key, Number(e.target.value))}
                  className="h-1.5 flex-1 accent-[var(--df-teal)]"
                  aria-label={`${m.label} weight`}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={raw}
                  onChange={(e) => setWeight(m.key, Number(e.target.value))}
                  className="w-16 rounded-df-md border border-border bg-canvas px-2 py-1 text-sm text-navy outline-none focus:border-teal"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setWeights({ ...DEFAULT_RANKING_WEIGHTS })} className="text-xs text-teal hover:underline">
          Reset to suggested weights
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            {flash ? <span className="font-medium text-emerald">Saved.</span> : dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save weights"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted">
        The suggested weights are a starting point, not a validated model — expect to re-tune them after a few weeks of
        real use. Scores are computed fresh on each Today load, so a change here takes effect on the next refresh.
      </p>
    </div>
  );
}
