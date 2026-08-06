"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateRoiPayback } from "@/lib/calculators/roiPayback";
import { whatsappHref } from "@/lib/nav";
import { toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

type FormState = {
  monthlySubscriptionCostZmw: string;
  oneTimeImplementationCostZmw: string;
  fuelZmw: string;
  complianceZmw: string;
  adminTimeZmw: string;
  maintenanceZmw: string;
  otherZmw: string;
};

const initialState: FormState = {
  monthlySubscriptionCostZmw: "6000",
  oneTimeImplementationCostZmw: "0",
  fuelZmw: "4000",
  complianceZmw: "2000",
  adminTimeZmw: "3000",
  maintenanceZmw: "2500",
  otherZmw: "0",
};

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function RoiPaybackCalculator() {
  const [form, setForm] = useState<FormState>(initialState);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: string) {
    setActiveScenario(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const scenarios: Scenario<FormState>[] = useMemo(
    () => [
      {
        label: "All savings +20%",
        apply: (f) => ({
          ...f,
          fuelZmw: round2(toNumber(f.fuelZmw) * 1.2),
          complianceZmw: round2(toNumber(f.complianceZmw) * 1.2),
          adminTimeZmw: round2(toNumber(f.adminTimeZmw) * 1.2),
          maintenanceZmw: round2(toNumber(f.maintenanceZmw) * 1.2),
          otherZmw: round2(toNumber(f.otherZmw) * 1.2),
        }),
      },
      {
        label: "All savings −20%",
        apply: (f) => ({
          ...f,
          fuelZmw: round2(toNumber(f.fuelZmw) * 0.8),
          complianceZmw: round2(toNumber(f.complianceZmw) * 0.8),
          adminTimeZmw: round2(toNumber(f.adminTimeZmw) * 0.8),
          maintenanceZmw: round2(toNumber(f.maintenanceZmw) * 0.8),
          otherZmw: round2(toNumber(f.otherZmw) * 0.8),
        }),
      },
      { label: "Subscription +10%", apply: (f) => ({ ...f, monthlySubscriptionCostZmw: round2(toNumber(f.monthlySubscriptionCostZmw) * 1.1) }) },
      { label: "Fuel savings +30%", apply: (f) => ({ ...f, fuelZmw: round2(toNumber(f.fuelZmw) * 1.3) }) },
      { label: "Add setup cost", apply: (f) => ({ ...f, oneTimeImplementationCostZmw: round2(toNumber(f.oneTimeImplementationCostZmw) + 15000) }) },
    ],
    []
  );

  function applyScenario(scenario: Scenario<FormState>) {
    setForm((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
  }

  const result = useMemo(
    () =>
      calculateRoiPayback({
        monthlySubscriptionCostZmw: toNumber(form.monthlySubscriptionCostZmw),
        oneTimeImplementationCostZmw: toNumber(form.oneTimeImplementationCostZmw),
        monthlySavings: {
          fuelZmw: toNumber(form.fuelZmw),
          complianceZmw: toNumber(form.complianceZmw),
          adminTimeZmw: toNumber(form.adminTimeZmw),
          maintenanceZmw: toNumber(form.maintenanceZmw),
          otherZmw: toNumber(form.otherZmw),
        },
      }),
    [form]
  );

  const hasEnoughToShow = toNumber(form.monthlySubscriptionCostZmw) > 0;

  const chartData = [
    { label: "Fuel", value: toNumber(form.fuelZmw) },
    { label: "Compliance", value: toNumber(form.complianceZmw) },
    { label: "Admin time", value: toNumber(form.adminTimeZmw) },
    { label: "Maintenance", value: toNumber(form.maintenanceZmw) },
    { label: "Other", value: toNumber(form.otherZmw) },
  ].filter((d) => d.value > 0);

  function buildAiPrompt(): string {
    return `DeployFleet ROI check:
- Monthly subscription: ${formatZmw(toNumber(form.monthlySubscriptionCostZmw))}
- One-time implementation cost: ${formatZmw(toNumber(form.oneTimeImplementationCostZmw))}
- Total estimated monthly savings: ${formatZmw(result.totalMonthlySavingsZmw)}
- Net monthly benefit: ${formatZmw(result.netMonthlyBenefitZmw)}
- Payback: ${result.paybackMonths === null ? "not reached at these numbers" : `${result.paybackMonths.toFixed(1)} months`}
- 3-year net gain: ${formatZmw(result.threeYearNetGainZmw)}, ROI: ${result.threeYearRoiPercent === null ? "n/a" : `${result.threeYearRoiPercent.toFixed(0)}%`}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · DeployFleet ROI &amp; Payback</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          Does DeployFleet actually pay for itself for your fleet?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Put in your own
          quoted subscription cost and your own estimate of what it would
          save you — fuel waste caught, compliance penalties avoided,
          admin hours back, fewer surprise breakdowns — and see the
          payback period and 3-year return. No DeployFleet price is
          assumed for you; pricing is a conversation, not a fixed number
          yet.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Cost</legend>
            <SliderField
              id="monthlySubscriptionCostZmw"
              label="Monthly subscription cost"
              value={toNumber(form.monthlySubscriptionCostZmw)}
              onChange={(v) => set("monthlySubscriptionCostZmw", v.toString())}
              max={50000}
              step={250}
              unit="ZMW"
              hint="From your quote."
            />
            <SliderField
              id="oneTimeImplementationCostZmw"
              label="One-time setup cost"
              value={toNumber(form.oneTimeImplementationCostZmw)}
              onChange={(v) => set("oneTimeImplementationCostZmw", v.toString())}
              max={100000}
              step={1000}
              unit="ZMW"
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Estimated monthly savings</legend>
            <SliderField
              id="fuelZmw"
              label="Fuel waste caught"
              value={toNumber(form.fuelZmw)}
              onChange={(v) => set("fuelZmw", v.toString())}
              max={30000}
              step={200}
              unit="ZMW"
            />
            <SliderField
              id="complianceZmw"
              label="Compliance penalties avoided"
              value={toNumber(form.complianceZmw)}
              onChange={(v) => set("complianceZmw", v.toString())}
              max={30000}
              step={200}
              unit="ZMW"
            />
            <SliderField
              id="adminTimeZmw"
              label="Admin time saved (valued)"
              value={toNumber(form.adminTimeZmw)}
              onChange={(v) => set("adminTimeZmw", v.toString())}
              max={30000}
              step={200}
              unit="ZMW"
            />
            <SliderField
              id="maintenanceZmw"
              label="Maintenance caught early"
              value={toNumber(form.maintenanceZmw)}
              onChange={(v) => set("maintenanceZmw", v.toString())}
              max={30000}
              step={200}
              unit="ZMW"
            />
            <SliderField
              id="otherZmw"
              label="Other"
              value={toNumber(form.otherZmw)}
              onChange={(v) => set("otherZmw", v.toString())}
              max={30000}
              step={200}
              unit="ZMW"
            />
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Payback period</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  {result.paybackMonths === null ? (
                    "Not reached"
                  ) : result.paybackMonths === 0 ? (
                    "Immediate"
                  ) : (
                    <>
                      <HeroMetric value={result.paybackMonths} formatter={(v) => v.toFixed(1)} /> mo
                    </>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted">
                  <HeroMetric value={result.netMonthlyBenefitZmw} formatter={(v) => formatZmw(v)} />/month net benefit
                </p>

                {chartData.length > 0 && (
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Savings by category</p>
                    <div className="mt-2">
                      <MiniBarChart data={chartData} />
                    </div>
                  </div>
                )}

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Total monthly savings</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.totalMonthlySavingsZmw} formatter={(v) => formatZmw(v)} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">3-year total cost</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.threeYearTotalCostZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">3-year total savings</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.threeYearTotalSavingsZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border-soft pt-3">
                    <dt className="text-body">3-year net gain</dt>
                    <dd className="font-medium text-navy">
                      <HeroMetric value={result.threeYearNetGainZmw} formatter={(v) => formatZmw(v)} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">3-year ROI</dt>
                    <dd className="font-medium text-navy">
                      {result.threeYearRoiPercent === null ? "n/a" : `${result.threeYearRoiPercent.toFixed(0)}%`}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

                <AiInsightPanel feature="roi-payback" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">Enter your monthly subscription cost to see the payback numbers.</p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Get a real number for your fleet</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              These are your own estimates. Talk to us for a quote sized to
              your fleet, and a realistic savings estimate based on what
              similar operators have seen.
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
