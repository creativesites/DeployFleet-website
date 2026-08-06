"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateFleetTco, type FleetTcoInputs } from "@/lib/calculators/fleetTco";
import { DIESEL_PRICE_ZMW_PER_LITRE, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { StepperField } from "@/components/intelligence-hub/StepperField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

// This calculator predates the multi-country Experience Layer retrofit and
// was deliberately left out of the Zmw-field-renaming scope (see the
// "Zmw-field-naming" decision in README.md) — it's still Zambia/ZMW-only,
// same as before. Only the visual layer (sliders, hero metric, chart,
// scenarios) is new here.
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
  purchasePriceZmw: "800000",
  annualDistanceKm: "120000",
  fuelCostPerKmZmw: "5",
  annualMaintenanceTyresZmw: "60000",
  maintenanceGrowthRatePercent: "8",
  annualInsuranceLicensingZmw: "35000",
  annualFinancingCostZmw: "0",
  annualDepreciationRatePercent: "15",
  horizonYears: "10",
};

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function FleetTcoCalculator() {
  const [form, setForm] = useState<FormState>(initialState);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setActiveScenario(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const scenarios: Scenario<FormState>[] = useMemo(
    () => [
      { label: "Fuel cost +15%", apply: (f) => ({ ...f, fuelCostPerKmZmw: round2(toNumber(f.fuelCostPerKmZmw) * 1.15) }) },
      { label: "Maintenance grows faster", apply: (f) => ({ ...f, maintenanceGrowthRatePercent: round2(toNumber(f.maintenanceGrowthRatePercent) + 5) }) },
      { label: "Resale declines faster", apply: (f) => ({ ...f, annualDepreciationRatePercent: round2(toNumber(f.annualDepreciationRatePercent) + 5) }) },
      { label: "Distance +20%", apply: (f) => ({ ...f, annualDistanceKm: Math.round(toNumber(f.annualDistanceKm) * 1.2).toString() }) },
      { label: "Better purchase price −10%", apply: (f) => ({ ...f, purchasePriceZmw: round2(toNumber(f.purchasePriceZmw) * 0.9) }) },
    ],
    []
  );

  function applyScenario(scenario: Scenario<FormState>) {
    setForm((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
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
  const chartData = result.years.map((y) => ({ label: `Y${y.year}`, value: y.costPerYearZmw }));

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
          Adjust the levers, watch the number respond. Purchase price,
          running costs that grow as the vehicle ages, and a resale value
          that shrinks — projected year by year to find the point where
          holding onto the truck longer stops being the cheaper option.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Purchase &amp; usage</legend>
            <SliderField
              id="purchasePriceZmw"
              label="Purchase price"
              value={toNumber(form.purchasePriceZmw)}
              onChange={(v) => set("purchasePriceZmw", v.toString())}
              max={3000000}
              step={5000}
              unit="ZMW"
            />
            <SliderField
              id="annualDistanceKm"
              label="Annual distance"
              value={toNumber(form.annualDistanceKm)}
              onChange={(v) => set("annualDistanceKm", v.toString())}
              max={300000}
              step={5000}
              unit="km"
            />
            <SliderField
              id="fuelCostPerKmZmw"
              label="Fuel cost"
              value={toNumber(form.fuelCostPerKmZmw)}
              onChange={(v) => set("fuelCostPerKmZmw", v.toString())}
              max={20}
              step={0.1}
              unit="ZMW/km"
              hint={`From your own Cost Per Kilometre result, or estimate from ${formatSourceLabel(DIESEL_PRICE_ZMW_PER_LITRE)}.`}
            />
            <StepperField
              id="horizonYears"
              label="Years to project"
              value={toNumber(form.horizonYears)}
              onChange={(v) => set("horizonYears", v.toString())}
              min={1}
              max={20}
              step={1}
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Annual running costs (year 1)</legend>
            <SliderField
              id="annualMaintenanceTyresZmw"
              label="Maintenance & tyres"
              value={toNumber(form.annualMaintenanceTyresZmw)}
              onChange={(v) => set("annualMaintenanceTyresZmw", v.toString())}
              max={300000}
              step={1000}
              unit="ZMW"
            />
            <SliderField
              id="maintenanceGrowthRatePercent"
              label="Maintenance growth"
              value={toNumber(form.maintenanceGrowthRatePercent)}
              onChange={(v) => set("maintenanceGrowthRatePercent", v.toString())}
              max={30}
              step={0.5}
              unit="%/year"
              hint="How much more maintenance typically costs each year as the vehicle ages."
            />
            <SliderField
              id="annualInsuranceLicensingZmw"
              label="Insurance & licensing"
              value={toNumber(form.annualInsuranceLicensingZmw)}
              onChange={(v) => set("annualInsuranceLicensingZmw", v.toString())}
              max={100000}
              step={500}
              unit="ZMW"
            />
            <SliderField
              id="annualFinancingCostZmw"
              label="Loan / lease repayment"
              value={toNumber(form.annualFinancingCostZmw)}
              onChange={(v) => set("annualFinancingCostZmw", v.toString())}
              max={400000}
              step={1000}
              unit="ZMW"
              hint="0 for a cash purchase."
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Resale</legend>
            <SliderField
              id="annualDepreciationRatePercent"
              label="Resale value lost per year"
              value={toNumber(form.annualDepreciationRatePercent)}
              onChange={(v) => set("annualDepreciationRatePercent", v.toString())}
              max={40}
              step={0.5}
              unit="%"
              hint="Applied to the prior year's value, not the original price. Floored at 5% of the purchase price."
            />
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {hasEnoughToShow && optimalYear ? (
              <>
                <p className="text-sm font-medium text-muted">Lowest-cost replacement point</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  Year <HeroMetric value={result.optimalReplacementYear} formatter={(v) => Math.round(v).toString()} />
                  <span className="text-lg font-medium text-muted"> of {inputs.horizonYears}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  <HeroMetric value={optimalYear.costPerYearZmw} formatter={(v) => formatZmw(v)} />
                  /year — <HeroMetric value={optimalYear.costPerKmZmw} formatter={(v) => formatZmw(v)} />/km
                </p>
                <p className="mt-3 text-xs text-muted">
                  This is the year with the lowest cost-per-year averaged
                  over the time you&apos;ve owned the truck (purchase price
                  and running costs so far, minus what you&apos;d get
                  reselling it then) — not a discounted or financed
                  present-value figure, kept simple on purpose.
                </p>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cost per year</p>
                  <div className="mt-2">
                    <MiniBarChart data={chartData} />
                  </div>
                </div>

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

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
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
