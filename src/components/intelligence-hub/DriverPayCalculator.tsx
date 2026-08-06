"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateDriverPay, type DriverPayInputs } from "@/lib/calculators/driverPay";
import { formatMoney } from "@/lib/countries";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";
import { CountrySelector } from "@/components/intelligence-hub/CountrySelector";
import { useSelectedCountry } from "@/components/intelligence-hub/useSelectedCountry";

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
  baseSalaryMonthly: "",
  overtimeHours: "",
  overtimeRatePerHour: "",
  tripAllowancesMonthly: "",
  otherDeductions: "",
  outstandingAdvanceBalance: "",
  advanceDeductionRequested: "",
};

export default function DriverPayCalculator() {
  const [form, setForm] = useState<FormState>(initialState);
  const { country, countryCode, selectCountry } = useSelectedCountry();

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const money = (v: number) => formatMoney(v, country);
  const available = country.coverage === "full" && country.incomeTax && country.socialSecurity;

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

  function buildAiPrompt(): string {
    if (!result) return "";
    return `Driver pay calculation for one month, ${country.name} (${country.currencyCode}):
- Gross pay: ${money(result.grossPay)} (base + overtime + trip allowances)
- ${result.socialSecurityLabel} (employee): ${money(result.socialSecurityAmount)}
- Income tax: ${money(result.incomeTaxAmount)}${result.taxLevyAmount > 0 ? ` + ${result.taxLevyLabel} ${money(result.taxLevyAmount)}` : ""}
${result.secondaryLevyAmount > 0 ? `- ${result.secondaryLevyLabel}: ${money(result.secondaryLevyAmount)}\n` : ""}- Advance deducted this period: ${money(result.advanceDeductionApplied)} (${money(result.remainingAdvanceBalance)} still outstanding)
- Other deductions: ${money(result.otherDeductionsApplied)}
- Net payable: ${money(result.netPayable)}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Driver Pay &amp; Advance</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          What does a driver actually take home this month?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Base pay, overtime, and trip allowances in — statutory
          deductions and any advance recovery worked out correctly, net
          pay out. Pick your country below; the deduction rules and
          currency switch to match.
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
            <legend className="px-1 text-sm font-semibold text-navy">Pay this month</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="baseSalaryMonthly"
                label="Base salary (monthly)"
                value={form.baseSalaryMonthly}
                onChange={(v) => set("baseSalaryMonthly", v)}
                placeholder="e.g. 8000"
              />
              <NumberField
                id="tripAllowancesMonthly"
                label="Trip allowances (monthly)"
                value={form.tripAllowancesMonthly}
                onChange={(v) => set("tripAllowancesMonthly", v)}
                placeholder="0"
              />
              <NumberField
                id="overtimeHours"
                label="Overtime hours"
                value={form.overtimeHours}
                onChange={(v) => set("overtimeHours", v)}
                placeholder="0"
                step="1"
              />
              <NumberField
                id="overtimeRatePerHour"
                label={`Overtime rate (${country.currencyCode}/hour)`}
                value={form.overtimeRatePerHour}
                onChange={(v) => set("overtimeRatePerHour", v)}
                placeholder="0"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Advance &amp; other deductions</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="outstandingAdvanceBalance"
                label="Outstanding advance balance"
                value={form.outstandingAdvanceBalance}
                onChange={(v) => set("outstandingAdvanceBalance", v)}
                placeholder="0"
                hint="What the driver still owes on a prior advance, before this pay period."
              />
              <NumberField
                id="advanceDeductionRequested"
                label="Advance to recover this period"
                value={form.advanceDeductionRequested}
                onChange={(v) => set("advanceDeductionRequested", v)}
                placeholder="0"
                hint="Capped automatically at the outstanding balance and at what's left after statutory deductions."
              />
              <NumberField
                id="otherDeductions"
                label="Other deductions"
                value={form.otherDeductions}
                onChange={(v) => set("otherDeductions", v)}
                placeholder="0"
                hint="Union dues, uniform, etc."
              />
            </div>
          </fieldset>

          {available && country.incomeTax && country.socialSecurity && (
            <div className="card-surface p-6">
              <p className="text-sm font-semibold text-navy">Statutory rates used — {country.name}</p>
              <ul className="mt-3 space-y-2 text-sm text-body">
                <li>
                  <strong className="text-navy">{country.socialSecurity.value.label}:</strong>{" "}
                  {(country.socialSecurity.value.employeeRate * 100).toFixed(1)}% employee share, capped at{" "}
                  {money(country.socialSecurity.value.employeeCapPerMonth)}/month. Source: {country.socialSecurity.source}.
                </li>
                {country.secondaryLevy && (
                  <li>
                    <strong className="text-navy">{country.secondaryLevy.value.label}:</strong>{" "}
                    {(country.secondaryLevy.value.employeeRate * 100).toFixed(1)}% of gross,{" "}
                    {country.secondaryLevy.value.employeeCapPerMonth === null ? "no cap" : `capped at ${money(country.secondaryLevy.value.employeeCapPerMonth)}`}
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
          <div className="card-surface p-6">
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
                <p className="mt-1 text-4xl font-bold text-navy">{money(result.netPayable)}</p>
                <p className="mt-1 text-sm text-muted">from {money(result.grossPay)} gross</p>

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
