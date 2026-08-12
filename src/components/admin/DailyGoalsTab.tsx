"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DAILY_GOAL_FIELDS,
  DEFAULT_DAILY_GOALS,
  type DailyGoalSet,
  type GoalsConfig,
  type Weekday,
} from "@/lib/crmTypes";

/** Monday-first ordering for a work week; 0 = Sunday in the underlying data. */
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};
const WEEKDAY_SHORT: Record<Weekday, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };

function GoalFieldGrid({
  values,
  onChange,
}: {
  values: DailyGoalSet;
  onChange: (key: keyof DailyGoalSet, value: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {DAILY_GOAL_FIELDS.map(({ key, label, tracked }) => (
        <label key={key} className="block">
          <span className="flex items-center gap-1 text-xs font-medium text-body">
            {label}
            {!tracked && (
              <span
                title="No automatic daily count yet — shown as a target only on the Command Strip."
                className="rounded-full border border-border px-1 text-[9px] font-semibold uppercase text-muted"
              >
                target
              </span>
            )}
          </span>
          <input
            type="number"
            min={0}
            max={1000}
            value={values[key]}
            onChange={(e) => onChange(key, Number(e.target.value))}
            className="mt-1 w-full rounded-df-md border border-border bg-canvas px-3 py-2 text-sm text-navy outline-none focus:border-teal"
          />
        </label>
      ))}
    </div>
  );
}

export default function DailyGoalsTab() {
  const [loaded, setLoaded] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [defaults, setDefaults] = useState<DailyGoalSet>(DEFAULT_DAILY_GOALS);
  const [overrides, setOverrides] = useState<Partial<Record<Weekday, DailyGoalSet>>>({});
  const [savedConfig, setSavedConfig] = useState<GoalsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/crm/goals")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        const config = data.config as GoalsConfig;
        setDefaults(config.default);
        // Materialize each stored partial override into a full goal set so
        // the editor's inputs are always populated; only weekdays present
        // in the config start as overrides.
        const materialized: Partial<Record<Weekday, DailyGoalSet>> = {};
        for (const [dayKey, partial] of Object.entries(config.overrides ?? {})) {
          const day = Number(dayKey) as Weekday;
          materialized[day] = { ...config.default, ...partial };
        }
        setOverrides(materialized);
        setSavedConfig(config);
        setPersistent(data.persistent);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!savedConfig) return true;
    if (JSON.stringify(defaults) !== JSON.stringify(savedConfig.default)) return true;
    const savedDays = Object.keys(savedConfig.overrides ?? {}).sort();
    const currentDays = Object.keys(overrides).sort();
    if (savedDays.join() !== currentDays.join()) return true;
    for (const day of currentDays) {
      const current = overrides[Number(day) as Weekday]!;
      const savedPartial = { ...savedConfig.default, ...savedConfig.overrides[Number(day) as Weekday] };
      if (JSON.stringify(current) !== JSON.stringify(savedPartial)) return true;
    }
    return false;
  }, [defaults, overrides, savedConfig]);

  function setDefaultField(key: keyof DailyGoalSet, value: number) {
    setDefaults((prev) => ({ ...prev, [key]: Number.isFinite(value) && value >= 0 ? value : 0 }));
  }

  function toggleOverride(day: Weekday, enabled: boolean) {
    setOverrides((prev) => {
      const next = { ...prev };
      if (enabled) next[day] = { ...defaults, ...prev[day] };
      else delete next[day];
      return next;
    });
  }

  function setOverrideField(day: Weekday, key: keyof DailyGoalSet, value: number) {
    setOverrides((prev) => ({
      ...prev,
      [day]: { ...prev[day]!, [key]: Number.isFinite(value) && value >= 0 ? value : 0 },
    }));
  }

  async function save() {
    setSaving(true);
    // Store only the fields that differ from the default for each override,
    // so a later change to a default value still flows through to days that
    // didn't explicitly diverge on that field.
    const overridesPayload: Partial<Record<Weekday, Partial<DailyGoalSet>>> = {};
    for (const [dayKey, set] of Object.entries(overrides)) {
      const day = Number(dayKey) as Weekday;
      const partial: Partial<DailyGoalSet> = {};
      for (const { key } of DAILY_GOAL_FIELDS) {
        if (set![key] !== defaults[key]) partial[key] = set![key];
      }
      overridesPayload[day] = partial;
    }
    const res = await fetch("/api/admin/crm/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default: defaults, overrides: overridesPayload }),
    });
    const data = await res.json();
    if (data.ok) {
      setSavedConfig(data.config);
      setPersistent(data.persistent);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
    setSaving(false);
  }

  if (!loaded) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-8">
      {!persistent && (
        <div className="rounded-df-md border border-amber bg-[color-mix(in_srgb,var(--df-amber)_10%,transparent)] p-4 text-sm text-amber">
          Running on the in-memory fallback store — changes here will be lost on the next cold start/redeploy. Attach a
          Redis/KV integration in the Vercel dashboard (any provider setting <code>KV_REST_API_URL</code>/
          <code>KV_REST_API_TOKEN</code> or <code>UPSTASH_REDIS_REST_URL</code>/<code>UPSTASH_REDIS_REST_TOKEN</code>) to
          make edits here durable — no code change needed once attached.
        </div>
      )}

      {/* Default targets */}
      <section className="card-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-navy">Default daily targets</h2>
            <p className="mt-1 text-xs text-muted">Applied to every day unless a weekday below overrides it.</p>
          </div>
          <button
            type="button"
            onClick={() => setDefaults({ ...DEFAULT_DAILY_GOALS })}
            className="text-xs text-teal hover:underline"
          >
            Reset to shipped defaults
          </button>
        </div>
        <div className="mt-4">
          <GoalFieldGrid values={defaults} onChange={setDefaultField} />
        </div>
      </section>

      {/* Per-weekday overrides */}
      <section>
        <h2 className="text-sm font-semibold text-navy">Per-weekday overrides</h2>
        <p className="mt-1 text-xs text-muted">
          Give a specific weekday its own targets — e.g. a lighter Friday, or a research-heavy Monday. Days without an
          override use the defaults above.
        </p>
        <div className="mt-4 space-y-2">
          {WEEKDAY_ORDER.map((day) => {
            const enabled = overrides[day] !== undefined;
            return (
              <div key={day} className="card-surface p-4">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => toggleOverride(day, e.target.checked)}
                    className="h-4 w-4 accent-[var(--df-teal)]"
                  />
                  <span className="text-sm font-medium text-navy">{WEEKDAY_LABEL[day]}</span>
                  <span className="text-xs text-muted">{enabled ? "Custom targets" : "Uses defaults"}</span>
                </label>
                {enabled && (
                  <div className="mt-4 border-t border-border pt-4">
                    <GoalFieldGrid
                      values={overrides[day]!}
                      onChange={(key, value) => setOverrideField(day, key, value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="text-xs text-muted">
          {savedFlash ? (
            <span className="font-medium text-emerald">Saved.</span>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            "All changes saved"
          )}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save goals"}
        </button>
      </div>

      <p className="text-xs text-muted">
        These targets drive the Command Strip on <code>Today</code> and the Targets scoreboard. Fields tagged{" "}
        <span className="rounded-full border border-border px-1 text-[9px] font-semibold uppercase text-muted">target</span>{" "}
        ({DAILY_GOAL_FIELDS.filter((f) => !f.tracked).map((f) => f.label.toLowerCase()).join(", ")}) don&apos;t have an
        automatic daily counter yet, so they show as a target to hit rather than a live progress bar.
        {savedConfig && savedConfig.updatedAt !== new Date(0).toISOString() && (
          <> Last saved {new Date(savedConfig.updatedAt).toLocaleString(undefined, { timeZone: "UTC" })} UTC.</>
        )}
        {WEEKDAY_ORDER.every((d) => overrides[d] === undefined) && <> No weekday overrides configured — {WEEKDAY_SHORT[1]}–{WEEKDAY_SHORT[0]} all use the defaults.</>}
      </p>
    </div>
  );
}
