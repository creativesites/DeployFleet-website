"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateRoiPayback } from "@/lib/calculators/roiPayback";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

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
  monthlySubscriptionCostZmw: "",
  oneTimeImplementationCostZmw: "0",
  fuelZmw: "",
  complianceZmw: "",
  adminTimeZmw: "",
  maintenanceZmw: "",
  otherZmw: "",
};

export default function RoiPaybackCalculator() {
  const [form, setForm] = useState<FormState>(initialState);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
          Put in your own quoted subscription cost and your own estimate of
          what it would save you — fuel waste caught, compliance penalties
          avoided, admin hours back, fewer surprise breakdowns — and see
          the payback period and 3-year return. No DeployFleet price is
          assumed for you; pricing is a conversation, not a fixed number
          yet.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Cost</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="monthlySubscriptionCostZmw"
                label="Monthly subscription cost (ZMW)"
                value={form.monthlySubscriptionCostZmw}
                onChange={(v) => set("monthlySubscriptionCostZmw", v)}
                placeholder="From your quote"
              />
              <NumberField
                id="oneTimeImplementationCostZmw"
                label="One-time setup cost (ZMW)"
                value={form.oneTimeImplementationCostZmw}
                onChange={(v) => set("oneTimeImplementationCostZmw", v)}
                placeholder="0"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Estimated monthly savings</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField id="fuelZmw" label="Fuel waste caught" value={form.fuelZmw} onChange={(v) => set("fuelZmw", v)} placeholder="0" />
              <NumberField
                id="complianceZmw"
                label="Compliance penalties avoided"
                value={form.complianceZmw}
                onChange={(v) => set("complianceZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="adminTimeZmw"
                label="Admin time saved (valued)"
                value={form.adminTimeZmw}
                onChange={(v) => set("adminTimeZmw", v)}
                placeholder="0"
              />
              <NumberField
                id="maintenanceZmw"
                label="Maintenance caught early"
                value={form.maintenanceZmw}
                onChange={(v) => set("maintenanceZmw", v)}
                placeholder="0"
              />
              <NumberField id="otherZmw" label="Other" value={form.otherZmw} onChange={(v) => set("otherZmw", v)} placeholder="0" />
            </div>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Payback period</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  {result.paybackMonths === null
                    ? "Not reached"
                    : result.paybackMonths === 0
                      ? "Immediate"
                      : `${result.paybackMonths.toFixed(1)} mo`}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatZmw(result.netMonthlyBenefitZmw)}/month net benefit
                </p>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Total monthly savings</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.totalMonthlySavingsZmw)}</dd>
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
                    <dd className="font-medium text-navy">{formatZmw(result.threeYearNetGainZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">3-year ROI</dt>
                    <dd className="font-medium text-navy">
                      {result.threeYearRoiPercent === null ? "n/a" : `${result.threeYearRoiPercent.toFixed(0)}%`}
                    </dd>
                  </div>
                </dl>

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
