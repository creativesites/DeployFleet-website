"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateDriverPay, type DriverPayInputs, type DriverPayResult } from "@/lib/calculators/driverPay";
import { formatMoney } from "@/lib/countries";
import { whatsappHref } from "@/lib/nav";
import { toNumber } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { CountrySelector } from "@/components/intelligence-hub/CountrySelector";
import { useSelectedCountry } from "@/components/intelligence-hub/useSelectedCountry";
import { SliderField } from "@/components/intelligence-hub/SliderField";
import { StepperField } from "@/components/intelligence-hub/StepperField";
import { HeroMetric } from "@/components/intelligence-hub/HeroMetric";
import { MiniBarChart } from "@/components/intelligence-hub/MiniBarChart";
import { HealthGauge, type GaugeStatus } from "@/components/intelligence-hub/HealthGauge";
import { ScenarioRow, type Scenario } from "@/components/intelligence-hub/ScenarioRow";

type FormState = {
  baseSalaryMonthly: string;
  overtimeHours: string;
  overtimeRatePerHour: string;
  tripAllowancesMonthly: string;
  otherDeductions: string;
  outstandingAdvanceBalance: string;
  advanceDeductionRequested: string;
};

const initialState: FormState = {
  baseSalaryMonthly: "8000",
  overtimeHours: "0",
  overtimeRatePerHour: "60",
  tripAllowancesMonthly: "0",
  otherDeductions: "0",
  outstandingAdvanceBalance: "0",
  advanceDeductionRequested: "0",
};

/** Same cross-currency magnitude proxy as the flagship Cost Per Km calculator — see currencyScale() there for the full rationale. */
function currencyScale(dieselPricePerLitre: number | undefined): number {
  return dieselPricePerLitre && dieselPricePerLitre > 0 ? dieselPricePerLitre : 25;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function takeHomeStatus(percent: number): GaugeStatus {
  if (percent >= 75) return "healthy";
  if (percent >= 60) return "warning";
  return "danger";
}

export default function DriverPayCalculator() {
  const [form, setForm] = useState<FormState>(initialState);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const { country, countryCode, selectCountry } = useSelectedCountry();

  // Same render-time reset pattern as the flagship Cost Per Km calculator
  // — a scenario chip ("Clear advance this period") from the previous
  // country shouldn't stay highlighted against a different country's
  // freshly-reset numbers.
  const [prevCountryCode, setPrevCountryCode] = useState(countryCode);
  if (countryCode !== prevCountryCode) {
    setPrevCountryCode(countryCode);
    setActiveScenario(null);
  }

  function set<K extends keyof FormState>(key: K, value: string) {
    setActiveScenario(null);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const money = (v: number) => formatMoney(v, country);
  const scale = currencyScale(country.dieselPricePerLitre?.value);
  const available = country.coverage === "full" && country.incomeTax && country.socialSecurity;

  const scenarios: Scenario<FormState>[] = useMemo(
    () => [
      { label: "Base salary +10%", apply: (f) => ({ ...f, baseSalaryMonthly: round2(toNumber(f.baseSalaryMonthly) * 1.1) }) },
      { label: "Overtime +10 hours", apply: (f) => ({ ...f, overtimeHours: (toNumber(f.overtimeHours) + 10).toString() }) },
      { label: "Trip allowances +10%", apply: (f) => ({ ...f, tripAllowancesMonthly: round2(toNumber(f.tripAllowancesMonthly) * 1.1) }) },
      { label: "Advance recovery +50%", apply: (f) => ({ ...f, advanceDeductionRequested: round2(toNumber(f.advanceDeductionRequested) * 1.5) }) },
      {
        label: "Clear advance this period",
        apply: (f) => ({ ...f, advanceDeductionRequested: f.outstandingAdvanceBalance }),
      },
    ],
    []
  );

  function applyScenario(scenario: Scenario<FormState>) {
    setForm((prev) => scenario.apply(prev));
    setActiveScenario(scenario.label);
  }

  const inputs: DriverPayInputs | null = useMemo(() => {
    if (!available || !country.incomeTax || !country.socialSecurity) return null;
    return {
      baseSalaryMonthly: toNumber(form.baseSalaryMonthly),
      overtimeHours: toNumber(form.overtimeHours),
      overtimeRatePerHour: toNumber(form.overtimeRatePerHour),
      tripAllowancesMonthly: toNumber(form.tripAllowancesMonthly),
      otherDeductions: toNumber(form.otherDeductions),
      outstandingAdvanceBalance: toNumber(form.outstandingAdvanceBalance),
      advanceDeductionRequested: toNumber(form.advanceDeductionRequested),
      incomeTax: country.incomeTax.value,
      socialSecurity: country.socialSecurity.value,
      secondaryLevy: country.secondaryLevy?.value ?? null,
    };
  }, [available, country, form]);

  const result = useMemo(() => (inputs ? calculateDriverPay(inputs) : null), [inputs]);
  const hasEnoughToShow = result !== null && (inputs?.baseSalaryMonthly ?? 0) > 0;
  const takeHomePercent = result && result.grossPay > 0 ? (result.netPayable / result.grossPay) * 100 : 0;

  const chartData = useMemo(() => {
    if (!result) return [];
    const items: { label: string; value: number }[] = [
      { label: result.socialSecurityLabel, value: result.socialSecurityAmount },
      { label: "Income tax", value: result.incomeTaxAmount },
      { label: result.taxLevyLabel, value: result.taxLevyAmount },
      { label: result.secondaryLevyLabel, value: result.secondaryLevyAmount },
      { label: "Advance recovered", value: result.advanceDeductionApplied },
      { label: "Other deductions", value: result.otherDeductionsApplied },
    ];
    return items.filter((item) => item.value > 0);
  }, [result]);

  function buildAiPrompt(): string {
    if (!result) return "";
    const r: DriverPayResult = result;
    return `Driver pay calculation for one month, ${country.name} (${country.currencyCode}):
- Gross pay: ${money(r.grossPay)} (base + overtime + trip allowances)
- ${r.socialSecurityLabel} (employee): ${money(r.socialSecurityAmount)}
- Income tax: ${money(r.incomeTaxAmount)}${r.taxLevyAmount > 0 ? ` + ${r.taxLevyLabel} ${money(r.taxLevyAmount)}` : ""}
${r.secondaryLevyAmount > 0 ? `- ${r.secondaryLevyLabel}: ${money(r.secondaryLevyAmount)}\n` : ""}- Advance deducted this period: ${money(r.advanceDeductionApplied)} (${money(r.remainingAdvanceBalance)} still outstanding)
- Other deductions: ${money(r.otherDeductionsApplied)}
- Net payable: ${money(r.netPayable)}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Driver Pay &amp; Advance</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          What does a driver actually take home this month?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Adjust the levers, watch the number respond. Base pay, overtime,
          and trip allowances in — statutory deductions and any advance
          recovery worked out correctly, net pay out. Pick your country
          below; the deduction rules and currency switch to match.
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
            <legend className="px-1 text-sm font-semibold text-navy">Pay this month</legend>
            <SliderField
              id="baseSalaryMonthly"
              label="Base salary"
              value={toNumber(form.baseSalaryMonthly)}
              onChange={(v) => set("baseSalaryMonthly", v.toString())}
              max={Math.ceil(scale * 800)}
              step={Math.max(1, Math.round(scale * 4))}
              unit={country.currencyCode}
            />
            <SliderField
              id="tripAllowancesMonthly"
              label="Trip allowances"
              value={toNumber(form.tripAllowancesMonthly)}
              onChange={(v) => set("tripAllowancesMonthly", v.toString())}
              max={Math.ceil(scale * 200)}
              step={Math.max(1, Math.round(scale))}
              unit={country.currencyCode}
            />
            <StepperField
              id="overtimeHours"
              label="Overtime hours"
              value={toNumber(form.overtimeHours)}
              onChange={(v) => set("overtimeHours", v.toString())}
              min={0}
              max={120}
              step={1}
            />
            <SliderField
              id="overtimeRatePerHour"
              label="Overtime rate"
              value={toNumber(form.overtimeRatePerHour)}
              onChange={(v) => set("overtimeRatePerHour", v.toString())}
              max={Math.ceil(scale * 10)}
              step={scale > 10 ? 0.5 : 0.05}
              unit={`${country.currencyCode}/hour`}
            />
          </fieldset>

          <fieldset className="card-surface space-y-6 p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Advance &amp; other deductions</legend>
            <SliderField
              id="outstandingAdvanceBalance"
              label="Outstanding advance balance"
              value={toNumber(form.outstandingAdvanceBalance)}
              onChange={(v) => set("outstandingAdvanceBalance", v.toString())}
              max={Math.ceil(scale * 1000)}
              step={Math.max(1, Math.round(scale * 5))}
              unit={country.currencyCode}
              hint="What the driver still owes on a prior advance, before this pay period."
            />
            <SliderField
              id="advanceDeductionRequested"
              label="Advance to recover this period"
              value={toNumber(form.advanceDeductionRequested)}
              onChange={(v) => set("advanceDeductionRequested", v.toString())}
              max={Math.ceil(scale * 1000)}
              step={Math.max(1, Math.round(scale * 5))}
              unit={country.currencyCode}
              hint="Capped automatically at the outstanding balance and at what's left after statutory deductions."
            />
            <SliderField
              id="otherDeductions"
              label="Other deductions"
              value={toNumber(form.otherDeductions)}
              onChange={(v) => set("otherDeductions", v.toString())}
              max={Math.ceil(scale * 100)}
              step={Math.max(1, Math.round(scale * 0.5))}
              unit={country.currencyCode}
              hint="Union dues, uniform, etc."
            />
          </fieldset>

          {available && country.incomeTax && country.socialSecurity && (
            <div className="card-surface p-6">
              <p className="text-sm font-semibold text-navy">Statutory rates used — {country.name}</p>
              <ul className="mt-3 space-y-2 text-sm text-body">
                <li>
                  <strong className="text-navy">{country.socialSecurity.value.label}:</strong>{" "}
                  {(country.socialSecurity.value.employeeRate * 100).toFixed(1)}% employee share,{" "}
                  {country.socialSecurity.value.employeeCapPerMonth === null
                    ? "no cap"
                    : `capped at ${money(country.socialSecurity.value.employeeCapPerMonth)}/month`}
                  . Source: {country.socialSecurity.source}.
                </li>
                {country.secondaryLevy && (
                  <li>
                    <strong className="text-navy">{country.secondaryLevy.value.label}:</strong>{" "}
                    {country.secondaryLevy.value.employeeRate >= 1 && country.secondaryLevy.value.employeeCapPerMonth !== null
                      ? `a flat ${money(country.secondaryLevy.value.employeeCapPerMonth)}/month`
                      : `${(country.secondaryLevy.value.employeeRate * 100).toFixed(1)}% of gross, ${
                          country.secondaryLevy.value.employeeCapPerMonth === null
                            ? "no cap"
                            : `capped at ${money(country.secondaryLevy.value.employeeCapPerMonth)}`
                        }`}
                    . Source: {country.secondaryLevy.source}.
                  </li>
                )}
                <li>
                  <strong className="text-navy">Income tax:</strong> progressive {country.incomeTax.value.period}{" "}
                  bands{country.incomeTax.value.levyOnTaxPercent > 0 ? `, plus a ${country.incomeTax.value.levyOnTaxPercent}% ${country.incomeTax.value.levyOnTaxLabel} on the computed tax` : ""}. Source:{" "}
                  {country.incomeTax.source}.
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted">{country.incomeTax.note}</p>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="df-tilt-card card-surface p-6">
            {!available ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  Statutory deduction rules for {country.name} aren&apos;t sourced yet — pick a fully covered
                  country (Zambia or Zimbabwe) to see a net pay breakdown.
                </p>
              </div>
            ) : hasEnoughToShow && result ? (
              <>
                <p className="text-sm font-medium text-muted">Net payable</p>
                <p className="mt-1 text-4xl font-bold text-navy">
                  <HeroMetric value={result.netPayable} formatter={(v) => money(v)} />
                </p>
                <p className="mt-1 text-sm text-muted">
                  from <HeroMetric value={result.grossPay} formatter={(v) => money(v)} /> gross
                </p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted">Take-home share</span>
                    <span className="font-semibold text-navy">{takeHomePercent.toFixed(0)}%</span>
                  </div>
                  <div className="mt-1.5">
                    <HealthGauge percent={takeHomePercent} status={takeHomeStatus(takeHomePercent)} />
                  </div>
                </div>

                {chartData.length > 0 && (
                  <div className="mt-6 border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Deductions</p>
                    <div className="mt-2">
                      <MiniBarChart data={chartData} />
                    </div>
                  </div>
                )}

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Overtime pay</dt>
                    <dd className="font-medium text-navy">{money(result.overtimePay)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">{result.socialSecurityLabel} (employee)</dt>
                    <dd className="font-medium text-navy">-{money(result.socialSecurityAmount)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Income tax</dt>
                    <dd className="font-medium text-navy">-{money(result.incomeTaxAmount)}</dd>
                  </div>
                  {result.taxLevyAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">{result.taxLevyLabel}</dt>
                      <dd className="font-medium text-navy">-{money(result.taxLevyAmount)}</dd>
                    </div>
                  )}
                  {result.secondaryLevyAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">{result.secondaryLevyLabel}</dt>
                      <dd className="font-medium text-navy">-{money(result.secondaryLevyAmount)}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-border-soft pt-3">
                    <dt className="text-body">Net before advance</dt>
                    <dd className="font-medium text-navy">{money(result.netBeforeAdvance)}</dd>
                  </div>
                  {result.advanceDeductionApplied > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">Advance recovered</dt>
                      <dd className="font-medium text-navy">-{money(result.advanceDeductionApplied)}</dd>
                    </div>
                  )}
                  {result.otherDeductionsApplied > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">Other deductions</dt>
                      <dd className="font-medium text-navy">-{money(result.otherDeductionsApplied)}</dd>
                    </div>
                  )}
                  {result.remainingAdvanceBalance > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">Advance balance remaining</dt>
                      <dd className="font-medium text-navy">{money(result.remainingAdvanceBalance)}</dd>
                    </div>
                  )}
                </dl>

                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Try a scenario</p>
                  <div className="mt-3">
                    <ScenarioRow scenarios={scenarios} onApply={applyScenario} activeLabel={activeScenario} />
                  </div>
                </div>

                <AiInsightPanel feature="driver-pay" buildPrompt={buildAiPrompt} />
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">Enter a base salary to see the net payable breakdown.</p>
              </div>
            )}
          </div>

          <div className="card-surface mt-6 p-6">
            <p className="text-sm font-semibold text-navy">Payslips generated automatically</p>
            <p className="mt-2 text-sm leading-relaxed text-body">
              DeployFleet runs this exact calculation for every driver, every
              pay period, with advance and loan balances tracked
              automatically — no spreadsheet to keep in sync.
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
