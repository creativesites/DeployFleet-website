"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateTripProfitability,
  type RevenueMode,
  type TripProfitabilityInputs,
  type TripProfitabilityResult,
} from "@/lib/calculators/tripProfitability";
import { formatMoney } from "@/lib/countries";
import { whatsappHref } from "@/lib/nav";
import { toNumber } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { CountrySelector } from "@/components/intelligence-hub/CountrySelector";
import { useSelectedCountry } from "@/components/intelligence-hub/useSelectedCountry";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

type FormState = {
  distanceKm: string;
  revenueMode: RevenueMode;
  ratePerKm: string;
  lumpSum: string;
  fuelPricePerLitre: string;
  fuelConsumptionLPer100Km: string;
  driverAllowance: string;
  tolls: string;
  borderFees: string;
  tyresPerKm: string;
  maintenanceReservePerKm: string;
  otherCosts: string;
};

const emptyState: FormState = {
  distanceKm: "450",
  revenueMode: "perKm",
  ratePerKm: "30",
  lumpSum: "13500",
  fuelPricePerLitre: "",
  fuelConsumptionLPer100Km: "38",
  driverAllowance: "300",
  tolls: "200",
  borderFees: "0",
  tyresPerKm: "0.9",
  maintenanceReservePerKm: "0.6",
  otherCosts: "0",
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

/** Same cross-currency magnitude proxy as the flagship Cost Per Km calculator — see currencyScale() there for the full rationale. */
function currencyScale(dieselPricePerLitre: number | undefined): number {
  return dieselPricePerLitre && dieselPricePerLitre > 0 ? dieselPricePerLitre : 25;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function TripProfitabilityCalculator() {
  const [form, setForm] = useState<FormState>(emptyState);
  const [touchedFuelPrice, setTouchedFuelPrice] = useState(false);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const { country, countryCode, selectCountry } = useSelectedCountry();
  const money = (v: number) => formatMoney(v, country);
  const scale = currencyScale(country.dieselPricePerLitre?.value);

  // Same re-baseline-on-country-switch fix as Cost Per Km — see that
  // component for the full rationale. Adjusted during render, not in a
  // useEffect, per this project's set-state-in-effect lint rule.
  const [prevCountryCode, setPrevCountryCode] = useState(countryCode);
  if (countryCode !== prevCountryCode) {
    setPrevCountryCode(countryCode);
    setTouchedFuelPrice(false);
    setActiveScenario(null);
  }

  const fuelPriceValue =
    !touchedFuelPrice && country.dieselPricePerLitre ? country.dieselPricePerLitre.value.toString() : form.fuelPricePerLitre;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "fuelPricePerLitre") setTouchedFuelPrice(true);
    setActiveScenario(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const scenarios: Scenario<FormState>[] = useMemo(
    () => [
      { label: "Fuel +10%", apply: (f) => ({ ...f, fuelPricePerLitre: round2(toNumber(fuelPriceValue) * 1.1) }) },
      { label: "Fuel −10%", apply: (f) => ({ ...f, fuelPricePerLitre: round2(toNumber(fuelPriceValue) * 0.9) }) },
      { label: "Distance +20%", apply: (f) => ({ ...f, distanceKm: Math.round(toNumber(f.distanceKm) * 1.2).toString() }) },
      { label: "Driver allowance +10%", apply: (f) => ({ ...f, driverAllowance: round2(toNumber(f.driverAllowance) * 1.1) }) },
      { label: "Tolls +20%", apply: (f) => ({ ...f, tolls: round2(toNumber(f.tolls) * 1.2) }) },
    ],
    [fuelPriceValue]
  );

  function applyScenario(scenario: Scenario<FormState>) {
    setTouchedFuelPrice(true);
    setForm((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
  }

  const inputs: TripProfitabilityInputs = useMemo(
    () => ({
      distanceKm: toNumber(form.distanceKm),
      revenueMode: form.revenueMode,
      ratePerKm: toNumber(form.ratePerKm),
      lumpSum: toNumber(form.lumpSum),
      fuelPricePerLitre: toNumber(fuelPriceValue),
      fuelConsumptionLPer100Km: toNumber(form.fuelConsumptionLPer100Km),
      driverAllowance: toNumber(form.driverAllowance),
      tolls: toNumber(form.tolls),
      borderFees: toNumber(form.borderFees),
      tyresPerKm: toNumber(form.tyresPerKm),
      maintenanceReservePerKm: toNumber(form.maintenanceReservePerKm),
      otherCosts: toNumber(form.otherCosts),
    }),
    [form, fuelPriceValue]
  );

  const result = useMemo(() => calculateTripProfitability(inputs), [inputs]);
  const hasEnoughToShow =
    inputs.distanceKm > 0 &&
    inputs.fuelConsumptionLPer100Km > 0 &&
    (inputs.revenueMode === "perKm" ? inputs.ratePerKm > 0 : inputs.lumpSum > 0);
  const status = statusCopy[result.status];

  const chartData = result.breakdown.filter((item) => item.amount > 0).map((item) => ({ label: item.label, value: item.amount }));

  function buildAiPrompt(): string {
    const r: TripProfitabilityResult = result;
    const revenueDescription =
      inputs.revenueMode === "perKm" ? `${money(inputs.ratePerKm)}/km rate` : `${money(inputs.lumpSum)} lump sum`;
    return `Trip profitability for a ${inputs.distanceKm} km trip offered at ${revenueDescription} (${country.name}, ${country.currencyCode}):
- Revenue: ${money(r.totalRevenue)}
- Total cost: ${money(r.totalCost)} (fuel ${money(r.fuelCost)}, tyres/maintenance ${money(r.distanceCost)}, driver allowance ${money(inputs.driverAllowance)}, tolls ${money(inputs.tolls)}, border fees ${money(inputs.borderFees)})
- Gross profit: ${money(r.grossProfit)} (${r.profitMarginPercent.toFixed(1)}% margin)
- Break-even rate: ${money(r.breakEvenRatePerKm)}/km
- Status: ${r.status}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Trip Profitability</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Should you take this load?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Distance and what
          you&apos;re actually being offered, against every real cost — the
          profit, the margin, and the minimum rate that&apos;s still worth
          accepting. Distance is a manual entry for now; route auto-fill is
          coming.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Country</legend>
            <div className="mt-4">
              <CountrySelector countryCode={countryCode} onChange={selectCountry} />
            </div>
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Route &amp; revenue</legend>
            <SliderField
              id="distanceKm"
              label="Trip distance"
              value={toNumber(form.distanceKm)}
              onChange={(v) => set("distanceKm", v.toString())}
              min={0}
              max={3000}
              step={25}
              unit="km"
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
              <SliderField
                id="ratePerKm"
                label="Offered rate"
                value={toNumber(form.ratePerKm)}
                onChange={(v) => set("ratePerKm", v.toString())}
                max={Math.ceil(scale * 3)}
                step={scale > 10 ? 0.5 : 0.05}
                unit={`${country.currencyCode}/km`}
              />
            ) : (
              <SliderField
                id="lumpSum"
                label="Offered total"
                value={toNumber(form.lumpSum)}
                onChange={(v) => set("lumpSum", v.toString())}
                max={Math.ceil(scale * 800)}
                step={Math.max(1, Math.round(scale * 4))}
                unit={country.currencyCode}
              />
            )}
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Fuel</legend>
            <SliderField
              id="fuelConsumptionLPer100Km"
              label="Fuel consumption"
              value={toNumber(form.fuelConsumptionLPer100Km)}
              onChange={(v) => set("fuelConsumptionLPer100Km", v.toString())}
              min={10}
              max={80}
              step={0.5}
              unit="L/100km"
              hint="From your own fuel logs for this vehicle and load."
            />
            <SliderField
              id="fuelPricePerLitre"
              label="Diesel price"
              value={toNumber(fuelPriceValue)}
              onChange={(v) => set("fuelPricePerLitre", v.toString())}
              max={Math.ceil(scale * 3)}
              step={scale > 10 ? 0.1 : 0.01}
              unit={`${country.currencyCode}/L`}
              hint={
                country.dieselPricePerLitre
                  ? `Pre-filled from Source: ${country.dieselPricePerLitre.source}.`
                  : `Not sourced yet for ${country.name} — enter your own.`
              }
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Trip-specific costs</legend>
            <SliderField
              id="driverAllowance"
              label="Driver allowance / per diem"
              value={toNumber(form.driverAllowance)}
              onChange={(v) => set("driverAllowance", v.toString())}
              max={Math.ceil(scale * 100)}
              step={Math.max(1, Math.round(scale * 0.5))}
              unit={country.currencyCode}
            />
            <SliderField
              id="tolls"
              label="Tolls (total for this trip)"
              value={toNumber(form.tolls)}
              onChange={(v) => set("tolls", v.toString())}
              max={Math.ceil(scale * 200)}
              step={Math.max(1, Math.round(scale))}
              unit={country.currencyCode}
              hint={
                country.tolls
                  ? `Heavy vehicles (4+ axles) pay ${money(country.tolls.value.fourPlusAxleHeavy)}/gate — multiply by gates on this route. Source: ${country.tolls.source}.`
                  : `Toll data not sourced yet for ${country.name}.`
              }
            />
            <SliderField
              id="borderFees"
              label="Border fees / documentation"
              value={toNumber(form.borderFees)}
              onChange={(v) => set("borderFees", v.toString())}
              max={Math.ceil(scale * 200)}
              step={Math.max(1, Math.round(scale))}
              unit={country.currencyCode}
            />
            <SliderField
              id="otherCosts"
              label="Other costs"
              value={toNumber(form.otherCosts)}
              onChange={(v) => set("otherCosts", v.toString())}
              max={Math.ceil(scale * 100)}
              step={Math.max(1, Math.round(scale * 0.5))}
              unit={country.currencyCode}
            />
            <SliderField
              id="tyresPerKm"
              label="Tyres"
              value={toNumber(form.tyresPerKm)}
              onChange={(v) => set("tyresPerKm", v.toString())}
              max={Math.max(2, Math.ceil(scale / 4))}
              step={scale > 10 ? 0.05 : 0.005}
              unit={`${country.currencyCode}/km`}
            />
            <SliderField
              id="maintenanceReservePerKm"
              label="Maintenance reserve"
              value={toNumber(form.maintenanceReservePerKm)}
              onChange={(v) => set("maintenanceReservePerKm", v.toString())}
              max={Math.max(2, Math.ceil(scale / 4))}
              step={scale > 10 ? 0.05 : 0.005}
              unit={`${country.currencyCode}/km`}
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
                <p className="mt-4 text-sm font-medium text-muted">Gross profit</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  <HeroMetric value={result.grossProfit} formatter={(v) => money(v)} />
                </p>
                <p className="mt-1 text-sm text-muted">{status.description}</p>

                <div className="mt-6 border-t border-border pt-4">
                  <MiniBarChart data={chartData} />
                  <div className="mt-2 space-y-1.5">
                    {result.breakdown
                      .filter((item) => item.amount > 0)
                      .map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-xs">
                          <span className="text-muted">{item.label}</span>
                          <span className="font-medium text-navy">{money(item.amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Revenue</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.totalRevenue} formatter={(v) => money(v)} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Total cost</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.totalCost} formatter={(v) => money(v)} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Margin</dt>
                    <dd className="font-medium text-navy">{result.profitMarginPercent.toFixed(1)}%</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Profit per km</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.profitPerKm} formatter={(v) => money(v)} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Minimum viable rate</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.breakEvenRatePerKm} formatter={(v) => money(v)} />/km
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

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
