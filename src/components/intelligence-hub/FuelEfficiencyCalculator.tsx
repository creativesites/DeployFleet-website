"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateFuelEfficiency, type FuelEfficiencyInputs } from "@/lib/calculators/fuelEfficiency";
import { DIESEL_PRICE_ZMW_PER_LITRE, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { HealthGauge, type GaugeStatus } from "@/components/intelligence-hub/HealthGauge";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

type FormState = {
  distanceKm: string;
  actualFuelUsedLitres: string;
  expectedConsumptionLPer100Km: string;
  fuelPriceZmwPerLitre: string;
};

const initialState: FormState = {
  distanceKm: "1000",
  actualFuelUsedLitres: "400",
  expectedConsumptionLPer100Km: "38",
  fuelPriceZmwPerLitre: DIESEL_PRICE_ZMW_PER_LITRE.value.toString(),
};

const flagCopy: Record<string, { label: string; className: string; description: string; gauge: GaugeStatus }> = {
  "below-expected": {
    label: "Below expected",
    className: "bg-[color-mix(in_srgb,var(--df-emerald)_12%,transparent)] text-emerald",
    description: "Using less fuel than your baseline for this distance — worth understanding why, in case it's a fluke.",
    gauge: "healthy",
  },
  normal: {
    label: "On track",
    className: "bg-[color-mix(in_srgb,var(--df-border)_60%,transparent)] text-muted",
    description: "Within normal range of your expected consumption for this distance.",
    gauge: "healthy",
  },
  "above-expected": {
    label: "Above expected",
    className: "bg-[color-mix(in_srgb,var(--df-amber)_14%,transparent)] text-amber",
    description: "10–20% over your baseline — could be load, route, or driver behaviour. Worth a look.",
    gauge: "warning",
  },
  "significantly-above-expected": {
    label: "Significantly above expected",
    className: "bg-[color-mix(in_srgb,var(--df-danger)_12%,transparent)] text-danger",
    description: "20%+ over your baseline — under-inflated tyres, excessive idling, or a fuel leak/theft are worth ruling out.",
    gauge: "danger",
  },
};

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function FuelEfficiencyCalculator() {
  const [form, setForm] = useState<FormState>(initialState);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setActiveScenario(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const scenarios: Scenario<FormState>[] = useMemo(
    () => [
      { label: "Actual fuel +10%", apply: (f) => ({ ...f, actualFuelUsedLitres: round2(toNumber(f.actualFuelUsedLitres) * 1.1) }) },
      { label: "Actual fuel −10%", apply: (f) => ({ ...f, actualFuelUsedLitres: round2(toNumber(f.actualFuelUsedLitres) * 0.9) }) },
      { label: "Distance +20%", apply: (f) => ({ ...f, distanceKm: Math.round(toNumber(f.distanceKm) * 1.2).toString() }) },
      { label: "Looser baseline +2 L/100km", apply: (f) => ({ ...f, expectedConsumptionLPer100Km: round2(toNumber(f.expectedConsumptionLPer100Km) + 2) }) },
      { label: "Diesel price +10%", apply: (f) => ({ ...f, fuelPriceZmwPerLitre: round2(toNumber(f.fuelPriceZmwPerLitre) * 1.1) }) },
    ],
    []
  );

  function applyScenario(scenario: Scenario<FormState>) {
    setForm((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
  }

  const inputs: FuelEfficiencyInputs = useMemo(
    () => ({
      distanceKm: toNumber(form.distanceKm),
      actualFuelUsedLitres: toNumber(form.actualFuelUsedLitres),
      expectedConsumptionLPer100Km: toNumber(form.expectedConsumptionLPer100Km),
      fuelPriceZmwPerLitre: toNumber(form.fuelPriceZmwPerLitre),
    }),
    [form]
  );

  const result = useMemo(() => calculateFuelEfficiency(inputs), [inputs]);
  const hasEnoughToShow =
    inputs.distanceKm > 0 && inputs.actualFuelUsedLitres > 0 && inputs.expectedConsumptionLPer100Km > 0;
  const flag = flagCopy[result.flag];
  const onTargetPercent = Math.max(0, 100 - Math.abs(result.variancePercent));

  const chartData = [
    { label: "Expected", value: result.expectedFuelLitres },
    { label: "Actual", value: inputs.actualFuelUsedLitres },
  ];

  function buildAiPrompt(): string {
    return `Fuel efficiency check for a ${inputs.distanceKm} km trip:
- Actual fuel used: ${inputs.actualFuelUsedLitres} L (${result.actualConsumptionLPer100Km.toFixed(1)} L/100km)
- Expected baseline: ${inputs.expectedConsumptionLPer100Km} L/100km (${result.expectedFuelLitres.toFixed(1)} L expected)
- Variance: ${result.varianceLitres.toFixed(1)} L (${result.variancePercent.toFixed(1)}%)
- Cost variance: ${formatZmw(result.costVarianceZmw)}
- Flag: ${result.flag}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Fuel Cost &amp; Efficiency</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Is your fuel consumption where it should be?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Compare what a trip
          actually used against your own expected baseline for that
          vehicle. A gap of more than 10–20% is usually worth
          investigating — tyres, idling, route, or the fuel itself.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">This trip</legend>
            <SliderField
              id="distanceKm"
              label="Distance covered"
              value={toNumber(form.distanceKm)}
              onChange={(v) => set("distanceKm", v.toString())}
              max={5000}
              step={25}
              unit="km"
            />
            <SliderField
              id="actualFuelUsedLitres"
              label="Fuel actually used"
              value={toNumber(form.actualFuelUsedLitres)}
              onChange={(v) => set("actualFuelUsedLitres", v.toString())}
              max={2000}
              step={10}
              unit="litres"
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Your baseline</legend>
            <SliderField
              id="expectedConsumptionLPer100Km"
              label="Expected consumption"
              value={toNumber(form.expectedConsumptionLPer100Km)}
              onChange={(v) => set("expectedConsumptionLPer100Km", v.toString())}
              min={10}
              max={80}
              step={0.5}
              unit="L/100km"
              hint="This vehicle's own normal consumption — from its manual or your historical average. No industry default is used here on purpose; it varies too much by vehicle and load."
            />
            <SliderField
              id="fuelPriceZmwPerLitre"
              label="Diesel price"
              value={toNumber(form.fuelPriceZmwPerLitre)}
              onChange={(v) => set("fuelPriceZmwPerLitre", v.toString())}
              max={75}
              step={0.1}
              unit="ZMW/L"
              hint={`Pre-filled from ${formatSourceLabel(DIESEL_PRICE_ZMW_PER_LITRE)}.`}
            />
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${flag.className}`}>
                  {flag.label}
                </span>
                <p className="mt-4 text-sm font-medium text-muted">Actual consumption</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  <HeroMetric value={result.actualConsumptionLPer100Km} formatter={(v) => v.toFixed(1)} />
                  <span className="text-lg font-medium text-muted"> L/100km</span>
                </p>
                <p className="mt-1 text-sm text-muted">{flag.description}</p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted">On-target</span>
                    <span className="font-semibold text-navy">{onTargetPercent.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5">
                    <HealthGauge percent={onTargetPercent} status={flag.gauge} />
                  </div>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Expected vs. actual</p>
                  <div className="mt-2">
                    <MiniBarChart data={chartData} />
                  </div>
                </div>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Expected fuel for this trip</dt>
                    <dd className="font-medium text-navy">{result.expectedFuelLitres.toFixed(1)} L</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Variance</dt>
                    <dd className="font-medium text-navy">
                      {result.varianceLitres >= 0 ? "+" : ""}
                      {result.varianceLitres.toFixed(1)} L ({result.variancePercent >= 0 ? "+" : ""}
                      {result.variancePercent.toFixed(1)}%)
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Actual fuel cost</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.actualCostZmw} formatter={(v) => formatZmw(v)} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Cost variance</dt>
                    <dd className="font-medium text-navy">
                      {result.costVarianceZmw >= 0 ? "+" : ""}
                      {formatZmw(result.costVarianceZmw)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

                <AiInsightPanel feature="fuel-efficiency" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Enter the distance, actual fuel used, and your expected
                  consumption to see the variance.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Catch this automatically, every trip</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet flags fuel anomalies as soon as a log is entered
              — not the next time someone happens to check.
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
