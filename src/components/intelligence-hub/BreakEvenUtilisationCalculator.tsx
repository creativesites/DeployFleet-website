"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateBreakEvenUtilisation,
  type BreakEvenUtilisationInputs,
} from "@/lib/calculators/breakEvenUtilisation";
import { whatsappHref } from "@/lib/nav";
import { toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { StepperField } from "@/components/intelligence-hub/StepperField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { HealthGauge, type GaugeStatus } from "@/components/intelligence-hub/HealthGauge";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

// Zambia/ZMW-only, same as before — not one of the 3 calculators in scope
// for the multi-country field-renaming pass (see README.md).
type FormState = {
  numberOfTrucks: string;
  fixedCostsMonthlyZmwPerTruck: string;
  variableCostPerKmZmw: string;
  revenuePerKmZmw: string;
  maxKmPerTruckPerMonth: string;
  actualKmPerTruckPerMonth: string;
  rampUpMonths: string;
  projectionMonths: string;
};

const initialState: FormState = {
  numberOfTrucks: "1",
  fixedCostsMonthlyZmwPerTruck: "15000",
  variableCostPerKmZmw: "6",
  revenuePerKmZmw: "10",
  maxKmPerTruckPerMonth: "10000",
  actualKmPerTruckPerMonth: "7000",
  rampUpMonths: "0",
  projectionMonths: "12",
};

const statusCopy: Record<string, { label: string; className: string; description: string }> = {
  "below-break-even": {
    label: "Below break-even",
    className: "bg-[color-mix(in_srgb,var(--df-danger)_12%,transparent)] text-danger",
    description: "Current utilisation isn't covering fixed costs at this rate — losing money every month at this pace.",
  },
  "at-break-even": {
    label: "At break-even",
    className: "bg-[color-mix(in_srgb,var(--df-border)_60%,transparent)] text-muted",
    description: "Right on the line — fixed costs are just about covered, with no real margin either way.",
  },
  "above-break-even": {
    label: "Above break-even",
    className: "bg-[color-mix(in_srgb,var(--df-emerald)_12%,transparent)] text-emerald",
    description: "Running above the break-even point — every extra kilometre past break-even is profit.",
  },
};

const GAUGE_STATUS: Record<string, GaugeStatus> = {
  "below-break-even": "danger",
  "at-break-even": "warning",
  "above-break-even": "healthy",
};

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function BreakEvenUtilisationCalculator() {
  const [form, setForm] = useState<FormState>(initialState);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setActiveScenario(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const scenarios: Scenario<FormState>[] = useMemo(
    () => [
      { label: "Revenue +10%", apply: (f) => ({ ...f, revenuePerKmZmw: round2(toNumber(f.revenuePerKmZmw) * 1.1) }) },
      { label: "Variable cost −10%", apply: (f) => ({ ...f, variableCostPerKmZmw: round2(toNumber(f.variableCostPerKmZmw) * 0.9) }) },
      { label: "Fixed costs −10%", apply: (f) => ({ ...f, fixedCostsMonthlyZmwPerTruck: round2(toNumber(f.fixedCostsMonthlyZmwPerTruck) * 0.9) }) },
      { label: "Utilisation +20%", apply: (f) => ({ ...f, actualKmPerTruckPerMonth: Math.round(toNumber(f.actualKmPerTruckPerMonth) * 1.2).toString() }) },
      { label: "Add a truck", apply: (f) => ({ ...f, numberOfTrucks: (toNumber(f.numberOfTrucks) + 1).toString() }) },
    ],
    []
  );

  function applyScenario(scenario: Scenario<FormState>) {
    setForm((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
  }

  const inputs: BreakEvenUtilisationInputs = useMemo(
    () => ({
      numberOfTrucks: toNumber(form.numberOfTrucks),
      fixedCostsMonthlyZmwPerTruck: toNumber(form.fixedCostsMonthlyZmwPerTruck),
      variableCostPerKmZmw: toNumber(form.variableCostPerKmZmw),
      revenuePerKmZmw: toNumber(form.revenuePerKmZmw),
      maxKmPerTruckPerMonth: toNumber(form.maxKmPerTruckPerMonth),
      actualKmPerTruckPerMonth: toNumber(form.actualKmPerTruckPerMonth),
      rampUpMonths: toNumber(form.rampUpMonths),
      projectionMonths: Math.min(36, toNumber(form.projectionMonths)),
    }),
    [form]
  );

  const result = useMemo(() => calculateBreakEvenUtilisation(inputs), [inputs]);
  const hasEnoughToShow =
    inputs.fixedCostsMonthlyZmwPerTruck > 0 && inputs.maxKmPerTruckPerMonth > 0 && inputs.numberOfTrucks > 0;
  const status = statusCopy[result.status];
  const isAchievable = Number.isFinite(result.breakEvenKmPerTruckPerMonth);

  const chartData = useMemo(
    () => [
      { label: "Current", value: inputs.actualKmPerTruckPerMonth },
      { label: "Break-even", value: isAchievable ? result.breakEvenKmPerTruckPerMonth : 0 },
      { label: "Max", value: inputs.maxKmPerTruckPerMonth },
    ],
    [inputs.actualKmPerTruckPerMonth, inputs.maxKmPerTruckPerMonth, isAchievable, result.breakEvenKmPerTruckPerMonth]
  );

  function buildAiPrompt(): string {
    return `Break-even utilisation for a fleet of ${inputs.numberOfTrucks} truck(s):
- Break-even: ${isAchievable ? `${result.breakEvenKmPerTruckPerMonth.toFixed(0)} km/truck/month (${result.breakEvenUtilisationPercent.toFixed(1)}% utilisation)` : "not achievable at this rate — revenue per km doesn't cover variable cost per km"}
- Current: ${inputs.actualKmPerTruckPerMonth.toLocaleString()} km/truck/month (${result.currentUtilisationPercent.toFixed(1)}% utilisation), status: ${result.status}
- Monthly fleet profit at current utilisation: ${formatZmw(result.monthlyFleetProfitAtCurrentUtilisationZmw)}
- Break-even month in the cash flow projection: ${result.breakEvenMonth ?? `not within ${inputs.projectionMonths} months`}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Break-Even Utilisation</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          How much do your trucks need to move before you&apos;re profitable?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Fixed costs,
          variable cost per km, and your rate per km — turned into the
          break-even kilometres a truck needs each month, how today&apos;s
          utilisation compares, and a monthly cash flow projection.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Fleet &amp; rates</legend>
            <StepperField
              id="numberOfTrucks"
              label="Number of trucks"
              value={toNumber(form.numberOfTrucks)}
              onChange={(v) => set("numberOfTrucks", v.toString())}
              min={1}
              max={100}
              step={1}
            />
            <SliderField
              id="fixedCostsMonthlyZmwPerTruck"
              label="Fixed costs per truck"
              value={toNumber(form.fixedCostsMonthlyZmwPerTruck)}
              onChange={(v) => set("fixedCostsMonthlyZmwPerTruck", v.toString())}
              max={100000}
              step={500}
              unit="ZMW/month"
              hint="Insurance, NAPSA, licensing, financing, yard rent — everything that doesn't change with distance driven."
            />
            <SliderField
              id="variableCostPerKmZmw"
              label="Variable cost"
              value={toNumber(form.variableCostPerKmZmw)}
              onChange={(v) => set("variableCostPerKmZmw", v.toString())}
              max={20}
              step={0.1}
              unit="ZMW/km"
              hint="Fuel, tyres, maintenance reserve — from your Cost Per Kilometre result if you've already run it."
            />
            <SliderField
              id="revenuePerKmZmw"
              label="Revenue"
              value={toNumber(form.revenuePerKmZmw)}
              onChange={(v) => set("revenuePerKmZmw", v.toString())}
              max={30}
              step={0.1}
              unit="ZMW/km"
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Utilisation</legend>
            <SliderField
              id="maxKmPerTruckPerMonth"
              label="Max achievable"
              value={toNumber(form.maxKmPerTruckPerMonth)}
              onChange={(v) => set("maxKmPerTruckPerMonth", v.toString())}
              max={30000}
              step={500}
              unit="km/truck/month"
            />
            <SliderField
              id="actualKmPerTruckPerMonth"
              label="Actual, today"
              value={toNumber(form.actualKmPerTruckPerMonth)}
              onChange={(v) => set("actualKmPerTruckPerMonth", v.toString())}
              max={30000}
              step={500}
              unit="km/truck/month"
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Cash flow projection</legend>
            <StepperField
              id="rampUpMonths"
              label="Ramp-up months"
              value={toNumber(form.rampUpMonths)}
              onChange={(v) => set("rampUpMonths", v.toString())}
              min={0}
              max={24}
              step={1}
              hint="0 if you're already at your actual utilisation. Otherwise, months to reach it from a standing start (a new truck or route)."
            />
            <StepperField
              id="projectionMonths"
              label="Months to project"
              value={toNumber(form.projectionMonths)}
              onChange={(v) => set("projectionMonths", v.toString())}
              min={1}
              max={36}
              step={1}
            />
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                  {status.label}
                </span>
                <p className="mt-4 text-sm font-medium text-muted">Break-even, per truck</p>
                {isAchievable ? (
                  <>
                    <p className="mt-1 text-4xl font-bold text-navy">
                      <HeroMetric value={result.breakEvenKmPerTruckPerMonth} formatter={(v) => Math.round(v).toLocaleString()} />
                      <span className="text-lg font-medium text-muted"> km/month</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {result.breakEvenUtilisationPercent.toFixed(1)}% utilisation — you&apos;re at{" "}
                      {result.currentUtilisationPercent.toFixed(1)}%
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-danger">
                    Not achievable — your revenue per km doesn&apos;t cover your variable cost per km.
                  </p>
                )}
                <p className="mt-1 text-sm text-muted">{status.description}</p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted">Utilisation vs. max</span>
                    <span className="font-semibold text-navy">{result.currentUtilisationPercent.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5">
                    <HealthGauge percent={result.currentUtilisationPercent} status={GAUGE_STATUS[result.status]} />
                  </div>
                </div>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current vs. break-even vs. max</p>
                  <div className="mt-2">
                    <MiniBarChart data={chartData} />
                  </div>
                </div>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Contribution margin</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.contributionMarginPerKmZmw)}/km</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Fleet profit/month, today</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.monthlyFleetProfitAtCurrentUtilisationZmw} formatter={(v) => formatZmw(v)} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Cumulative cash flow break-even</dt>
                    <dd className="font-medium text-navy">
                      {result.breakEvenMonth ? `Month ${result.breakEvenMonth}` : `Not within ${inputs.projectionMonths}mo`}
                    </dd>
                  </div>
                </dl>

                {result.monthlyProjection.length > 0 && (
                  <div className="mt-6 max-h-64 overflow-y-auto border-t border-border pt-4">
                    <div className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      <span>Month</span>
                      <span className="text-right">Profit</span>
                      <span className="text-right">Cumulative</span>
                    </div>
                    {result.monthlyProjection.map((m) => (
                      <div key={m.month} className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <span className="font-medium text-navy">{m.month}</span>
                        <span className={`text-right ${m.fleetProfitZmw >= 0 ? "text-body" : "text-danger"}`}>
                          {formatZmw(m.fleetProfitZmw)}
                        </span>
                        <span className={`text-right font-medium ${m.cumulativeCashFlowZmw >= 0 ? "text-navy" : "text-danger"}`}>
                          {formatZmw(m.cumulativeCashFlowZmw)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

                <AiInsightPanel feature="break-even-utilisation" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Enter your fixed cost per truck, max monthly km, and truck
                  count to see your break-even point.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">See utilisation per truck, live</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet tracks actual km per truck against target
              automatically from completed trips — no manual odometer
              spreadsheet at month end.
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
