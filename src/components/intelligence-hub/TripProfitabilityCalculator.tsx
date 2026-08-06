"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateTripProfitability,
  type RevenueMode,
  type TripProfitabilityInputs,
} from "@/lib/calculators/tripProfitability";
import { formatMoney } from "@/lib/countries";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { CountrySelector } from "@/components/intelligence-hub/CountrySelector";
import { useSelectedCountry } from "@/components/intelligence-hub/useSelectedCountry";

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
  distanceKm: "",
  revenueMode: "perKm",
  ratePerKm: "",
  lumpSum: "",
  fuelPricePerLitre: "",
  fuelConsumptionLPer100Km: "",
  driverAllowance: "",
  tolls: "",
  borderFees: "",
  tyresPerKm: "",
  maintenanceReservePerKm: "",
  otherCosts: "",
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
  const [form, setForm] = useState<FormState>(emptyState);
  const [touchedFuelPrice, setTouchedFuelPrice] = useState(false);
  const { country, countryCode, selectCountry } = useSelectedCountry();
  const money = (v: number) => formatMoney(v, country);

  const fuelPriceValue =
    !touchedFuelPrice && country.dieselPricePerLitre ? country.dieselPricePerLitre.value.toString() : form.fuelPricePerLitre;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "fuelPricePerLitre") setTouchedFuelPrice(true);
    setForm((prev) => ({ ...prev, [key]: value }));
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

  function buildAiPrompt(): string {
    const revenueDescription =
      inputs.revenueMode === "perKm" ? `${money(inputs.ratePerKm)}/km rate` : `${money(inputs.lumpSum)} lump sum`;
    return `Trip profitability for a ${inputs.distanceKm} km trip offered at ${revenueDescription} (${country.name}, ${country.currencyCode}):
- Revenue: ${money(result.totalRevenue)}
- Total cost: ${money(result.totalCost)} (fuel ${money(result.fuelCost)}, tyres/maintenance ${money(result.distanceCost)}, driver allowance ${money(inputs.driverAllowance)}, tolls ${money(inputs.tolls)}, border fees ${money(inputs.borderFees)})
- Gross profit: ${money(result.grossProfit)} (${result.profitMarginPercent.toFixed(1)}% margin)
- Break-even rate: ${money(result.breakEvenRatePerKm)}/km
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
            <legend className="px-1 text-sm font-semibold text-navy">Country</legend>
            <div className="mt-4">
              <CountrySelector countryCode={countryCode} onChange={selectCountry} />
            </div>
          </fieldset>

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
                  id="ratePerKm"
                  label={`Offered rate (${country.currencyCode}/km)`}
                  value={form.ratePerKm}
                  onChange={(v) => set("ratePerKm", v)}
                  placeholder="e.g. 30"
                />
              ) : (
                <NumberField
                  id="lumpSum"
                  label={`Offered total (${country.currencyCode})`}
                  value={form.lumpSum}
                  onChange={(v) => set("lumpSum", v)}
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
                id="fuelPricePerLitre"
                label={`Diesel price (${country.currencyCode}/litre)`}
                value={fuelPriceValue}
                onChange={(v) => set("fuelPricePerLitre", v)}
                hint={
                  country.dieselPricePerLitre
                    ? `Pre-filled from Source: ${country.dieselPricePerLitre.source}.`
                    : `Not sourced yet for ${country.name} — enter your own.`
                }
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Trip-specific costs</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="driverAllowance"
                label="Driver allowance / per diem"
                value={form.driverAllowance}
                onChange={(v) => set("driverAllowance", v)}
                placeholder="0"
              />
              <NumberField
                id="tolls"
                label="Tolls (total for this trip)"
                value={form.tolls}
                onChange={(v) => set("tolls", v)}
                placeholder="0"
                hint={
                  country.tolls
                    ? `Heavy vehicles (4+ axles) pay ${money(country.tolls.value.fourPlusAxleHeavy)}/gate — multiply by gates on this route. Source: ${country.tolls.source}.`
                    : `Toll data not sourced yet for ${country.name}.`
                }
              />
              <NumberField
                id="borderFees"
                label="Border fees / documentation"
                value={form.borderFees}
                onChange={(v) => set("borderFees", v)}
                placeholder="0"
              />
              <NumberField
                id="otherCosts"
                label="Other costs"
                value={form.otherCosts}
                onChange={(v) => set("otherCosts", v)}
                placeholder="0"
              />
              <NumberField
                id="tyresPerKm"
                label={`Tyres (${country.currencyCode}/km)`}
                value={form.tyresPerKm}
                onChange={(v) => set("tyresPerKm", v)}
                placeholder="0"
              />
              <NumberField
                id="maintenanceReservePerKm"
                label={`Maintenance reserve (${country.currencyCode}/km)`}
                value={form.maintenanceReservePerKm}
                onChange={(v) => set("maintenanceReservePerKm", v)}
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
                <p className="mt-1 text-4xl font-bold text-navy">{money(result.grossProfit)}</p>
                <p className="mt-1 text-sm text-muted">{status.description}</p>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Revenue</dt>
                    <dd className="font-medium text-navy">{money(result.totalRevenue)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Total cost</dt>
                    <dd className="font-medium text-navy">{money(result.totalCost)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Margin</dt>
                    <dd className="font-medium text-navy">{result.profitMarginPercent.toFixed(1)}%</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Profit per km</dt>
                    <dd className="font-medium text-navy">{money(result.profitPerKm)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Minimum viable rate</dt>
                    <dd className="font-medium text-navy">{money(result.breakEvenRatePerKm)}/km</dd>
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
