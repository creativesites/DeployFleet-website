"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateFleetTco, type FleetTcoInputs } from "@/lib/calculators/fleetTco";
import { DIESEL_PRICE_ZMW_PER_LITRE, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

type FormState = {
  purchasePriceZmw: string;
  annualDistanceKm: string;
  fuelCostPerKmZmw: string;
  annualMaintenanceTyresZmw: string;
  maintenanceGrowthRatePercent: string;
  annualInsuranceLicensingZmw: string;
  annualFinancingCostZmw: string;
  annualDepreciationRatePercent: string;
  horizonYears: string;
};

const initialState: FormState = {
  purchasePriceZmw: "",
  annualDistanceKm: "120000",
  fuelCostPerKmZmw: "",
  annualMaintenanceTyresZmw: "",
  maintenanceGrowthRatePercent: "8",
  annualInsuranceLicensingZmw: "",
  annualFinancingCostZmw: "0",
  annualDepreciationRatePercent: "15",
  horizonYears: "10",
};

export default function FleetTcoCalculator() {
  const [form, setForm] = useState<FormState>(initialState);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputs: FleetTcoInputs = useMemo(
    () => ({
      purchasePriceZmw: toNumber(form.purchasePriceZmw),
      annualDistanceKm: toNumber(form.annualDistanceKm),
      fuelCostPerKmZmw: toNumber(form.fuelCostPerKmZmw),
      annualMaintenanceTyresZmw: toNumber(form.annualMaintenanceTyresZmw),
      maintenanceGrowthRatePerYear: toNumber(form.maintenanceGrowthRatePercent) / 100,
      annualInsuranceLicensingZmw: toNumber(form.annualInsuranceLicensingZmw),
      annualFinancingCostZmw: toNumber(form.annualFinancingCostZmw),
      annualDepreciationRate: toNumber(form.annualDepreciationRatePercent) / 100,
      horizonYears: Math.min(20, toNumber(form.horizonYears)),
    }),
    [form]
  );

  const result = useMemo(() => calculateFleetTco(inputs), [inputs]);
  const hasEnoughToShow = inputs.purchasePriceZmw > 0 && inputs.annualDistanceKm > 0;
  const optimalYear = result.years.find((y) => y.year === result.optimalReplacementYear);

  function buildAiPrompt(): string {
    if (!optimalYear) return "";
    return `Fleet TCO projection for a truck bought at ${formatZmw(inputs.purchasePriceZmw)}, run ${inputs.annualDistanceKm.toLocaleString()} km/year over a ${inputs.horizonYears}-year horizon:
- Lowest equivalent-annual-cost year: year ${result.optimalReplacementYear} at ${formatZmw(optimalYear.costPerYearZmw)}/year (${formatZmw(optimalYear.costPerKmZmw)}/km)
- Year 1 cost: ${formatZmw(result.years[0]?.costPerYearZmw ?? 0)}/year
- Final year (${inputs.horizonYears}) cost: ${formatZmw(result.years[result.years.length - 1]?.costPerYearZmw ?? 0)}/year
- Maintenance grows ${form.maintenanceGrowthRatePercent}%/year, resale declines ${form.annualDepreciationRatePercent}%/year`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Fleet Total Cost of Ownership</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          What year does replacing this truck actually pay off?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Purchase price, running costs that grow as the vehicle ages, and a
          resale value that shrinks — projected year by year to find the
          point where holding onto the truck longer stops being the
          cheaper option.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Purchase &amp; usage</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="purchasePriceZmw"
                label="Purchase price"
                value={form.purchasePriceZmw}
                onChange={(v) => set("purchasePriceZmw", v)}
                placeholder="e.g. 800000"
                step="1000"
              />
              <NumberField
                id="annualDistanceKm"
                label="Annual distance (km)"
                value={form.annualDistanceKm}
                onChange={(v) => set("annualDistanceKm", v)}
                step="1000"
              />
              <NumberField
                id="fuelCostPerKmZmw"
                label="Fuel cost (ZMW/km)"
                value={form.fuelCostPerKmZmw}
                onChange={(v) => set("fuelCostPerKmZmw", v)}
                placeholder="e.g. 5"
                hint={`From your own Cost Per Kilometre result, or estimate from ${formatSourceLabel(DIESEL_PRICE_ZMW_PER_LITRE)}.`}
              />
              <NumberField
                id="horizonYears"
                label="Years to project (max 20)"
                value={form.horizonYears}
                onChange={(v) => set("horizonYears", v)}
                step="1"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Annual running costs (year 1)</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="annualMaintenanceTyresZmw"
                label="Maintenance &amp; tyres"
                value={form.annualMaintenanceTyresZmw}
                onChange={(v) => set("annualMaintenanceTyresZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="maintenanceGrowthRatePercent"
                label="Maintenance growth (%/year)"
                value={form.maintenanceGrowthRatePercent}
                onChange={(v) => set("maintenanceGrowthRatePercent", v)}
                hint="How much more maintenance typically costs each year as the vehicle ages."
              />
              <NumberField
                id="annualInsuranceLicensingZmw"
                label="Insurance &amp; licensing"
                value={form.annualInsuranceLicensingZmw}
                onChange={(v) => set("annualInsuranceLicensingZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="annualFinancingCostZmw"
                label="Loan / lease repayment"
                value={form.annualFinancingCostZmw}
                onChange={(v) => set("annualFinancingCostZmw", v)}
                placeholder="0"
                hint="0 for a cash purchase."
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Resale</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="annualDepreciationRatePercent"
                label="Resale value lost per year (%)"
                value={form.annualDepreciationRatePercent}
                onChange={(v) => set("annualDepreciationRatePercent", v)}
                hint="Applied to the prior year's value, not the original price. Floored at 5% of the purchase price."
              />
            </div>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow && optimalYear ? (
              <>
                <p className="text-sm font-medium text-muted">Lowest-cost replacement point</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  Year {result.optimalReplacementYear}
                  <span className="text-lg font-medium text-muted"> of {inputs.horizonYears}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatZmw(optimalYear.costPerYearZmw)}/year — {formatZmw(optimalYear.costPerKmZmw)}/km
                </p>
                <p className="mt-3 text-xs text-muted">
                  This is the year with the lowest cost-per-year averaged
                  over the time you&apos;ve owned the truck (purchase price
                  and running costs so far, minus what you&apos;d get
                  reselling it then) — not a discounted or financed
                  present-value figure, kept simple on purpose.
                </p>

                <div className="mt-6 max-h-80 overflow-y-auto border-t border-border pt-4">
                  <div className="grid grid-cols-4 gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <span>Year</span>
                    <span className="text-right">Cost/year</span>
                    <span className="text-right">Cost/km</span>
                    <span className="text-right">Resale</span>
                  </div>
                  {result.years.map((y) => (
                    <div
                      key={y.year}
                      className={`mt-2 grid grid-cols-4 gap-2 rounded-df-md px-1.5 py-1.5 text-sm ${
                        y.year === result.optimalReplacementYear ? "bg-[color-mix(in_srgb,var(--df-teal)_10%,transparent)]" : ""
                      }`}
                    >
                      <span className="font-medium text-navy">{y.year}</span>
                      <span className="text-right text-body">{formatZmw(y.costPerYearZmw)}</span>
                      <span className="text-right text-body">{formatZmw(y.costPerKmZmw)}</span>
                      <span className="text-right text-body">{formatZmw(y.resaleValueZmw)}</span>
                    </div>
                  ))}
                </div>

                <AiInsightPanel feature="fleet-tco" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Enter a purchase price and annual distance to see the
                  replacement-year projection.
                </p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Track real cost per truck, automatically</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet logs maintenance, fuel, and trips per vehicle, so
              this projection can run on your fleet&apos;s real numbers
              instead of estimates.
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
