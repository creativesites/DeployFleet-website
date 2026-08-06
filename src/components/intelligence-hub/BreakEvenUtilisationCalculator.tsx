"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateBreakEvenUtilisation,
  type BreakEvenUtilisationInputs,
} from "@/lib/calculators/breakEvenUtilisation";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

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
  fixedCostsMonthlyZmwPerTruck: "",
  variableCostPerKmZmw: "",
  revenuePerKmZmw: "",
  maxKmPerTruckPerMonth: "10000",
  actualKmPerTruckPerMonth: "",
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

export default function BreakEvenUtilisationCalculator() {
  const [form, setForm] = useState<FormState>(initialState);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          Fixed costs, variable cost per km, and your rate per km — turned
          into the break-even kilometres a truck needs each month, how
          today&apos;s utilisation compares, and a monthly cash flow
          projection.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Fleet &amp; rates</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="numberOfTrucks"
                label="Number of trucks"
                value={form.numberOfTrucks}
                onChange={(v) => set("numberOfTrucks", v)}
                step="1"
              />
              <NumberField
                id="fixedCostsMonthlyZmwPerTruck"
                label="Fixed costs per truck (monthly)"
                value={form.fixedCostsMonthlyZmwPerTruck}
                onChange={(v) => set("fixedCostsMonthlyZmwPerTruck", v)}
                placeholder="e.g. 15000"
                hint="Insurance, NAPSA, licensing, financing, yard rent — everything that doesn't change with distance driven."
              />
              <NumberField
                id="variableCostPerKmZmw"
                label="Variable cost (ZMW/km)"
                value={form.variableCostPerKmZmw}
                onChange={(v) => set("variableCostPerKmZmw", v)}
                placeholder="e.g. 6"
                hint="Fuel, tyres, maintenance reserve — from your Cost Per Kilometre result if you've already run it."
              />
              <NumberField
                id="revenuePerKmZmw"
                label="Revenue (ZMW/km)"
                value={form.revenuePerKmZmw}
                onChange={(v) => set("revenuePerKmZmw", v)}
                placeholder="e.g. 10"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Utilisation</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="maxKmPerTruckPerMonth"
                label="Max achievable km/truck/month"
                value={form.maxKmPerTruckPerMonth}
                onChange={(v) => set("maxKmPerTruckPerMonth", v)}
                step="500"
              />
              <NumberField
                id="actualKmPerTruckPerMonth"
                label="Actual km/truck/month today"
                value={form.actualKmPerTruckPerMonth}
                onChange={(v) => set("actualKmPerTruckPerMonth", v)}
                step="500"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Cash flow projection</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="rampUpMonths"
                label="Ramp-up months"
                value={form.rampUpMonths}
                onChange={(v) => set("rampUpMonths", v)}
                step="1"
                hint="0 if you're already at your actual utilisation. Otherwise, months to reach it from a standing start (a new truck or route)."
              />
              <NumberField
                id="projectionMonths"
                label="Months to project (max 36)"
                value={form.projectionMonths}
                onChange={(v) => set("projectionMonths", v)}
                step="1"
              />
            </div>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                  {status.label}
                </span>
                <p className="mt-4 text-sm font-medium text-muted">Break-even, per truck</p>
                {isAchievable ? (
                  <>
                    <p className="mt-1 text-4xl font-bold text-navy">
                      {Math.round(result.breakEvenKmPerTruckPerMonth).toLocaleString()}
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

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Contribution margin</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.contributionMarginPerKmZmw)}/km</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Fleet profit/month, today</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.monthlyFleetProfitAtCurrentUtilisationZmw)}</dd>
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
