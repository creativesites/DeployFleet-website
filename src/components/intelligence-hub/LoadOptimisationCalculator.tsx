"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateLoadOptimisation, type AxleGroupType } from "@/lib/calculators/loadOptimisation";
import { AXLE_LOAD_LIMITS, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { SelectField, toNumber } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { HealthGauge, type GaugeStatus } from "@/components/intelligence-hub/HealthGauge";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

type GroupFormState = {
  label: string;
  groupType: AxleGroupType;
  actualLoadKg: string;
};

const groupTypeOptions: { value: AxleGroupType; label: string }[] = [
  { value: "steering-single", label: "Steering (single)" },
  { value: "drive-single", label: "Drive (single)" },
  { value: "tandem", label: "Tandem" },
  { value: "tridem", label: "Tridem" },
];

const initialGroups: GroupFormState[] = [
  { label: "Steering axle", groupType: "steering-single", actualLoadKg: "6500" },
  { label: "Drive axle", groupType: "drive-single", actualLoadKg: "9000" },
  { label: "Trailer group 1", groupType: "tandem", actualLoadKg: "16000" },
  { label: "Trailer group 2", groupType: "tandem", actualLoadKg: "16000" },
];

function round0(n: number): string {
  return Math.round(n).toString();
}

export default function LoadOptimisationCalculator() {
  const [groups, setGroups] = useState<GroupFormState[]>(initialGroups);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const limits = AXLE_LOAD_LIMITS.value;

  function updateGroup<K extends keyof GroupFormState>(index: number, key: K, value: GroupFormState[K]) {
    setActiveScenario(null);
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, [key]: value } : g)));
  }

  const scenarioList: Scenario<GroupFormState[]>[] = useMemo(
    () => [
      { label: "All axles +10%", apply: (gs) => gs.map((g) => ({ ...g, actualLoadKg: round0(toNumber(g.actualLoadKg) * 1.1) })) },
      { label: "All axles −10%", apply: (gs) => gs.map((g) => ({ ...g, actualLoadKg: round0(toNumber(g.actualLoadKg) * 0.9) })) },
      { label: "Steering +500kg", apply: (gs) => gs.map((g, i) => (i === 0 ? { ...g, actualLoadKg: round0(toNumber(g.actualLoadKg) + 500) } : g)) },
      { label: "Drive +1000kg", apply: (gs) => gs.map((g, i) => (i === 1 ? { ...g, actualLoadKg: round0(toNumber(g.actualLoadKg) + 1000) } : g)) },
      { label: "Trailer axles +5%", apply: (gs) => gs.map((g, i) => (i >= 2 ? { ...g, actualLoadKg: round0(toNumber(g.actualLoadKg) * 1.05) } : g)) },
    ],
    []
  );

  function applyScenario(scenario: Scenario<GroupFormState[]>) {
    setGroups((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
  }

  const result = useMemo(
    () =>
      calculateLoadOptimisation({
        limits,
        groups: groups.map((g) => ({ label: g.label, groupType: g.groupType, actualLoadKg: toNumber(g.actualLoadKg) })),
      }),
    [groups, limits]
  );

  const hasEnoughToShow = groups.some((g) => g.actualLoadKg);
  const chartData = result.groups.map((g) => ({ label: g.label, value: g.actualLoadKg }));

  function groupGaugeStatus(percent: number): GaugeStatus {
    if (percent > 100) return "danger";
    if (percent >= 90) return "warning";
    return "healthy";
  }

  function buildAiPrompt(): string {
    const lines = result.groups.map(
      (g) => `- ${g.label} (${g.groupType}): ${g.actualLoadKg}kg actual vs ${g.allowedLoadKg.toFixed(0)}kg allowed — ${g.status}`
    );
    return `Axle load check, ${result.totalAxleCount} total axles, ${result.totalActualWeightKg.toLocaleString()}kg total weight:
${lines.join("\n")}
- GVM: ${result.gvmLimitKg ? `${result.gvmLimitKg.toLocaleString()}kg limit, ${result.gvmStatus}` : "no applicable limit at this axle count"}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Load Optimisation &amp; Axle Weight</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Is this load legal to move, axle by axle?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Enter what each axle
          group is actually carrying and check it against the harmonized
          regional axle load limits — the same Tripartite framework Zambia
          operates under.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {groups.map((group, index) => {
            const resultGroup = result.groups[index];
            const percent = resultGroup ? (resultGroup.actualLoadKg / resultGroup.allowedLoadKg) * 100 : 0;
            return (
              <fieldset key={index} className="card-surface space-y-4 p-6">
                <legend className="px-1 text-sm font-semibold text-navy">{group.label}</legend>
                <SelectField
                  id={`grouptype-${index}`}
                  label="Axle group type"
                  value={group.groupType}
                  onChange={(v) => updateGroup(index, "groupType", v as AxleGroupType)}
                  options={groupTypeOptions}
                />
                <SliderField
                  id={`load-${index}`}
                  label="Actual load"
                  value={toNumber(group.actualLoadKg)}
                  onChange={(v) => updateGroup(index, "actualLoadKg", v.toString())}
                  max={30000}
                  step={100}
                  unit="kg"
                />
                {resultGroup && toNumber(group.actualLoadKg) > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted">
                        {resultGroup.actualLoadKg.toLocaleString()} / {resultGroup.allowedLoadKg.toFixed(0)} kg
                      </span>
                      <span className="font-semibold text-navy">{percent.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1.5">
                      <HealthGauge percent={percent} status={groupGaugeStatus(percent)} />
                    </div>
                  </div>
                )}
              </fieldset>
            );
          })}

          <p className="text-xs text-muted">{formatSourceLabel(AXLE_LOAD_LIMITS)}. {AXLE_LOAD_LIMITS.note}</p>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    result.anyGroupOverloaded || result.gvmStatus === "overloaded"
                      ? "bg-[color-mix(in_srgb,var(--df-danger)_12%,transparent)] text-danger"
                      : "bg-[color-mix(in_srgb,var(--df-emerald)_12%,transparent)] text-emerald"
                  }`}
                >
                  {result.anyGroupOverloaded || result.gvmStatus === "overloaded" ? "Overloaded" : "Within limits"}
                </span>
                <p className="mt-4 text-sm font-medium text-muted">Total actual weight</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  <HeroMetric value={result.totalActualWeightKg} formatter={(v) => Math.round(v).toLocaleString()} />
                  <span className="text-lg font-medium text-muted"> kg</span>
                </p>
                <p className="mt-1 text-sm text-muted">{result.totalAxleCount} axles tracked</p>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Load by axle group</p>
                  <div className="mt-2">
                    <MiniBarChart data={chartData} />
                  </div>
                </div>

                <div className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                  {result.groups.map((g, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-body">{g.label}</span>
                      <span className={`font-medium ${g.status === "overloaded" ? "text-danger" : "text-navy"}`}>
                        {g.actualLoadKg.toLocaleString()} / {g.allowedLoadKg.toFixed(0)} kg
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-border pt-4 text-sm">
                  {result.gvmLimitKg ? (
                    <div className="flex items-center justify-between">
                      <span className="text-body">GVM ({result.gvmLimitKg.toLocaleString()}kg limit)</span>
                      <span className={`font-medium ${result.gvmStatus === "overloaded" ? "text-danger" : "text-navy"}`}>
                        {result.gvmStatus === "overloaded" ? `+${result.overGvmKg.toLocaleString()}kg over` : "Compliant"}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">
                      No sourced GVM cap applies below 6 total axles — only per-axle-group limits are checked.
                    </p>
                  )}
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarioList} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

                <AiInsightPanel feature="load-optimisation" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">Enter at least one axle group&apos;s actual load to see compliance.</p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Catch overload risk before the weighbridge does</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet flags compliance risk automatically — expired
              documents block dispatch before a truck ever leaves the yard.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/demo" className="btn-primary justify-center text-sm">
                View Demo
              </Link>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-secondary justify-center text-sm">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
