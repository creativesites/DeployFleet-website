"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateFuelEfficiency, type FuelEfficiencyInputs } from "@/lib/calculators/fuelEfficiency";
import { DIESEL_PRICE_ZMW_PER_LITRE, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

type FormState = {
  distanceKm: string;
  actualFuelUsedLitres: string;
  expectedConsumptionLPer100Km: string;
  fuelPriceZmwPerLitre: string;
};

const initialState: FormState = {
  distanceKm: "",
  actualFuelUsedLitres: "",
  expectedConsumptionLPer100Km: "",
  fuelPriceZmwPerLitre: DIESEL_PRICE_ZMW_PER_LITRE.value.toString(),
};

const flagCopy: Record<string, { label: string; className: string; description: string }> = {
  "below-expected": {
    label: "Below expected",
    className: "bg-[color-mix(in_srgb,var(--df-emerald)_12%,transparent)] text-emerald",
    description: "Using less fuel than your baseline for this distance — worth understanding why, in case it's a fluke.",
  },
  normal: {
    label: "On track",
    className: "bg-[color-mix(in_srgb,var(--df-border)_60%,transparent)] text-muted",
    description: "Within normal range of your expected consumption for this distance.",
  },
  "above-expected": {
    label: "Above expected",
    className: "bg-[color-mix(in_srgb,var(--df-amber)_14%,transparent)] text-amber",
    description: "10–20% over your baseline — could be load, route, or driver behaviour. Worth a look.",
  },
  "significantly-above-expected": {
    label: "Significantly above expected",
    className: "bg-[color-mix(in_srgb,var(--df-danger)_12%,transparent)] text-danger",
    description: "20%+ over your baseline — under-inflated tyres, excessive idling, or a fuel leak/theft are worth ruling out.",
  },
};

export default function FuelEfficiencyCalculator() {
  const [form, setForm] = useState<FormState>(initialState);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          Compare what a trip actually used against your own expected
          baseline for that vehicle. A gap of more than 10–20% is usually
          worth investigating — tyres, idling, route, or the fuel itself.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">This trip</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="distanceKm"
                label="Distance covered (km)"
                value={form.distanceKm}
                onChange={(v) => set("distanceKm", v)}
                placeholder="e.g. 1000"
                step="1"
              />
              <NumberField
                id="actualFuelUsedLitres"
                label="Fuel actually used (litres)"
                value={form.actualFuelUsedLitres}
                onChange={(v) => set("actualFuelUsedLitres", v)}
                placeholder="e.g. 380"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Your baseline</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="expectedConsumptionLPer100Km"
                label="Expected consumption (L/100km)"
                value={form.expectedConsumptionLPer100Km}
                onChange={(v) => set("expectedConsumptionLPer100Km", v)}
                placeholder="e.g. 38"
                hint="This vehicle's own normal consumption — from its manual or your historical average. No industry default is used here on purpose; it varies too much by vehicle and load."
              />
              <NumberField
                id="fuelPriceZmwPerLitre"
                label="Diesel price (ZMW/litre)"
                value={form.fuelPriceZmwPerLitre}
                onChange={(v) => set("fuelPriceZmwPerLitre", v)}
                hint={`Pre-filled from ${formatSourceLabel(DIESEL_PRICE_ZMW_PER_LITRE)}.`}
              />
            </div>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${flag.className}`}>
                  {flag.label}
                </span>
                <p className="mt-4 text-sm font-medium text-muted">Actual consumption</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  {result.actualConsumptionLPer100Km.toFixed(1)}
                  <span className="text-lg font-medium text-muted"> L/100km</span>
                </p>
                <p className="mt-1 text-sm text-muted">{flag.description}</p>

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
                    <dd className="font-medium text-navy">{formatZmw(result.actualCostZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Cost variance</dt>
                    <dd className="font-medium text-navy">
                      {result.costVarianceZmw >= 0 ? "+" : ""}
                      {formatZmw(result.costVarianceZmw)}
                    </dd>
                  </div>
                </dl>

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
