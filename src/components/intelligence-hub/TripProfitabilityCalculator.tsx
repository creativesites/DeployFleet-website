"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateTripProfitability,
  type RevenueMode,
  type TripProfitabilityInputs,
} from "@/lib/calculators/tripProfitability";
import { DIESEL_PRICE_ZMW_PER_LITRE, HEAVY_VEHICLE_TOLLS, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

type FormState = {
  distanceKm: string;
  revenueMode: RevenueMode;
  ratePerKmZmw: string;
  lumpSumZmw: string;
  fuelPriceZmwPerLitre: string;
  fuelConsumptionLPer100Km: string;
  driverAllowanceZmw: string;
  tollsZmw: string;
  borderFeesZmw: string;
  tyresPerKmZmw: string;
  maintenanceReservePerKmZmw: string;
  otherCostsZmw: string;
};

const initialState: FormState = {
  distanceKm: "",
  revenueMode: "perKm",
  ratePerKmZmw: "",
  lumpSumZmw: "",
  fuelPriceZmwPerLitre: DIESEL_PRICE_ZMW_PER_LITRE.value.toString(),
  fuelConsumptionLPer100Km: "",
  driverAllowanceZmw: "",
  tollsZmw: "",
  borderFeesZmw: "",
  tyresPerKmZmw: "",
  maintenanceReservePerKmZmw: "",
  otherCostsZmw: "",
};

const statusCopy: Record<string, { label: string; className: string; description: string }> = {
  healthy: {
    label: "Healthy margin",
    className: "bg-[color-mix(in_srgb,var(--df-emerald)_12%,transparent)] text-emerald",
    description: "This trip clears at least a 15% margin at the rate you entered.",
  },
  "thin-margin": {
    label: "Thin margin",
    className: "bg-[color-mix(in_srgb,var(--df-amber)_14%,transparent)] text-amber",
    description: "This trip is profitable, but below a comfortable 15% margin — worth negotiating.",
  },
  loss: {
    label: "Loses money",
    className: "bg-[color-mix(in_srgb,var(--df-danger)_12%,transparent)] text-danger",
    description: "At this rate, costs exceed revenue on this trip.",
  },
};

export default function TripProfitabilityCalculator() {
  const [form, setForm] = useState<FormState>(initialState);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputs: TripProfitabilityInputs = useMemo(
    () => ({
      distanceKm: toNumber(form.distanceKm),
      revenueMode: form.revenueMode,
      ratePerKmZmw: toNumber(form.ratePerKmZmw),
      lumpSumZmw: toNumber(form.lumpSumZmw),
      fuelPriceZmwPerLitre: toNumber(form.fuelPriceZmwPerLitre),
      fuelConsumptionLPer100Km: toNumber(form.fuelConsumptionLPer100Km),
      driverAllowanceZmw: toNumber(form.driverAllowanceZmw),
      tollsZmw: toNumber(form.tollsZmw),
      borderFeesZmw: toNumber(form.borderFeesZmw),
      tyresPerKmZmw: toNumber(form.tyresPerKmZmw),
      maintenanceReservePerKmZmw: toNumber(form.maintenanceReservePerKmZmw),
      otherCostsZmw: toNumber(form.otherCostsZmw),
    }),
    [form]
  );

  const result = useMemo(() => calculateTripProfitability(inputs), [inputs]);
  const hasEnoughToShow =
    inputs.distanceKm > 0 &&
    inputs.fuelConsumptionLPer100Km > 0 &&
    (inputs.revenueMode === "perKm" ? inputs.ratePerKmZmw > 0 : inputs.lumpSumZmw > 0);
  const status = statusCopy[result.status];

  function buildAiPrompt(): string {
    const revenueDescription =
      inputs.revenueMode === "perKm"
        ? `${formatZmw(inputs.ratePerKmZmw)}/km rate`
        : `${formatZmw(inputs.lumpSumZmw)} lump sum`;
    return `Trip profitability for a ${inputs.distanceKm} km trip offered at ${revenueDescription}:
- Revenue: ${formatZmw(result.totalRevenueZmw)}
- Total cost: ${formatZmw(result.totalCostZmw)} (fuel ${formatZmw(result.fuelCostZmw)}, tyres/maintenance ${formatZmw(result.distanceCostZmw)}, driver allowance ${formatZmw(inputs.driverAllowanceZmw)}, tolls ${formatZmw(inputs.tollsZmw)}, border fees ${formatZmw(inputs.borderFeesZmw)})
- Gross profit: ${formatZmw(result.grossProfitZmw)} (${result.profitMarginPercent.toFixed(1)}% margin)
- Break-even rate: ${formatZmw(result.breakEvenRatePerKmZmw)}/km
- Status: ${result.status}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Trip Profitability</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Should you take this load?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Enter the route and what you&apos;re actually being offered, and
          see the real profit — plus the minimum rate that&apos;s still
          worth accepting. Distance is a manual entry for now; route
          auto-fill is coming.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Route &amp; revenue</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="distanceKm"
                label="Trip distance (km)"
                value={form.distanceKm}
                onChange={(v) => set("distanceKm", v)}
                placeholder="e.g. 400"
                step="1"
              />
              <div>
                <span className="text-sm font-medium text-navy">Revenue type</span>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => set("revenueMode", "perKm")}
                    className={`flex-1 rounded-df-md border px-3 py-3 text-sm font-medium transition-colors ${
                      form.revenueMode === "perKm"
                        ? "border-teal bg-[color-mix(in_srgb,var(--df-teal)_10%,transparent)] text-navy"
                        : "border-border bg-canvas text-muted"
                    }`}
                  >
                    Rate per km
                  </button>
                  <button
                    type="button"
                    onClick={() => set("revenueMode", "lumpSum")}
                    className={`flex-1 rounded-df-md border px-3 py-3 text-sm font-medium transition-colors ${
                      form.revenueMode === "lumpSum"
                        ? "border-teal bg-[color-mix(in_srgb,var(--df-teal)_10%,transparent)] text-navy"
                        : "border-border bg-canvas text-muted"
                    }`}
                  >
                    Lump sum
                  </button>
                </div>
              </div>
              {form.revenueMode === "perKm" ? (
                <NumberField
                  id="ratePerKmZmw"
                  label="Offered rate (ZMW/km)"
                  value={form.ratePerKmZmw}
                  onChange={(v) => set("ratePerKmZmw", v)}
                  placeholder="e.g. 30"
                />
              ) : (
                <NumberField
                  id="lumpSumZmw"
                  label="Offered total (ZMW)"
                  value={form.lumpSumZmw}
                  onChange={(v) => set("lumpSumZmw", v)}
                  placeholder="e.g. 12000"
                />
              )}
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Fuel</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="fuelConsumptionLPer100Km"
                label="Fuel consumption (L/100km)"
                value={form.fuelConsumptionLPer100Km}
                onChange={(v) => set("fuelConsumptionLPer100Km", v)}
                placeholder="e.g. 38"
                hint="From your own fuel logs for this vehicle and load."
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

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Trip-specific costs</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="driverAllowanceZmw"
                label="Driver allowance / per diem"
                value={form.driverAllowanceZmw}
                onChange={(v) => set("driverAllowanceZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="tollsZmw"
                label="Tolls (total for this trip)"
                value={form.tollsZmw}
                onChange={(v) => set("tollsZmw", v)}
                placeholder="0"
                hint={`Heavy vehicles (4+ axles) pay ${formatZmw(HEAVY_VEHICLE_TOLLS.value.fourPlusAxleHeavyZmw)}/gate — multiply by gates on this route. ${formatSourceLabel(HEAVY_VEHICLE_TOLLS)}.`}
              />
              <NumberField
                id="borderFeesZmw"
                label="Border fees / documentation"
                value={form.borderFeesZmw}
                onChange={(v) => set("borderFeesZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="otherCostsZmw"
                label="Other costs"
                value={form.otherCostsZmw}
                onChange={(v) => set("otherCostsZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="tyresPerKmZmw"
                label="Tyres (ZMW/km)"
                value={form.tyresPerKmZmw}
                onChange={(v) => set("tyresPerKmZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="maintenanceReservePerKmZmw"
                label="Maintenance reserve (ZMW/km)"
                value={form.maintenanceReservePerKmZmw}
                onChange={(v) => set("maintenanceReservePerKmZmw", v)}
                placeholder="0"
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
                <p className="mt-4 text-sm font-medium text-muted">Gross profit</p>
                <p className="mt-1 text-4xl font-bold text-navy">{formatZmw(result.grossProfitZmw)}</p>
                <p className="mt-1 text-sm text-muted">{status.description}</p>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Revenue</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.totalRevenueZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Total cost</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.totalCostZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Margin</dt>
                    <dd className="font-medium text-navy">{result.profitMarginPercent.toFixed(1)}%</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Profit per km</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.profitPerKmZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Minimum viable rate</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.breakEvenRatePerKmZmw)}/km</dd>
                  </div>
                </dl>

                <AiInsightPanel feature="trip-profitability" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Enter the trip distance, fuel consumption, and the offered
                  rate to see whether this load is worth taking.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Never re-check a rate by hand again</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet scores every shipment against your real costs
              automatically, before you confirm the assignment.
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
