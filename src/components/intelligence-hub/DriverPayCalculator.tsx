"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { calculateDriverPay, type DriverPayInputs } from "@/lib/calculators/driverPay";
import { NAPSA, NHIMA, PAYE_BANDS, formatSourceLabel } from "@/lib/benchmarks";
import { whatsappHref } from "@/lib/nav";
import { NumberField, toNumber, formatZmw } from "@/components/intelligence-hub/NumberField";
import { AiInsightPanel } from "@/components/intelligence-hub/AiInsightPanel";

type FormState = {
  baseSalaryMonthlyZmw: string;
  overtimeHours: string;
  overtimeRateZmwPerHour: string;
  tripAllowancesMonthlyZmw: string;
  otherDeductionsZmw: string;
  outstandingAdvanceBalanceZmw: string;
  advanceDeductionRequestedZmw: string;
};

const initialState: FormState = {
  baseSalaryMonthlyZmw: "",
  overtimeHours: "",
  overtimeRateZmwPerHour: "",
  tripAllowancesMonthlyZmw: "",
  otherDeductionsZmw: "",
  outstandingAdvanceBalanceZmw: "",
  advanceDeductionRequestedZmw: "",
};

export default function DriverPayCalculator() {
  const [form, setForm] = useState<FormState>(initialState);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const inputs: DriverPayInputs = useMemo(
    () => ({
      baseSalaryMonthlyZmw: toNumber(form.baseSalaryMonthlyZmw),
      overtimeHours: toNumber(form.overtimeHours),
      overtimeRateZmwPerHour: toNumber(form.overtimeRateZmwPerHour),
      tripAllowancesMonthlyZmw: toNumber(form.tripAllowancesMonthlyZmw),
      otherDeductionsZmw: toNumber(form.otherDeductionsZmw),
      outstandingAdvanceBalanceZmw: toNumber(form.outstandingAdvanceBalanceZmw),
      advanceDeductionRequestedZmw: toNumber(form.advanceDeductionRequestedZmw),
      napsaEmployeeRate: NAPSA.value.employeeRate,
      napsaEmployeeCapZmw: NAPSA.value.employeeCapZmw,
      nhimaEmployeeRate: NHIMA.value.employeeRate,
      payeBands: PAYE_BANDS.value,
    }),
    [form]
  );

  const result = useMemo(() => calculateDriverPay(inputs), [inputs]);
  const hasEnoughToShow = inputs.baseSalaryMonthlyZmw > 0;

  function buildAiPrompt(): string {
    return `Driver pay calculation for one month:
- Gross pay: ${formatZmw(result.grossPayZmw)} (base + overtime + trip allowances)
- NAPSA (employee): ${formatZmw(result.napsaEmployeeZmw)}
- PAYE: ${formatZmw(result.payeZmw)}
- NHIMA: ${formatZmw(result.nhimaZmw)}
- Advance deducted this period: ${formatZmw(result.advanceDeductionAppliedZmw)} (${formatZmw(result.remainingAdvanceBalanceZmw)} still outstanding)
- Other deductions: ${formatZmw(result.otherDeductionsAppliedZmw)}
- Net payable: ${formatZmw(result.netPayableZmw)}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <span className="section-eyebrow">Intelligence Hub · Driver Pay &amp; Advance</span>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-navy sm:text-5xl">
          What does a driver actually take home this month?
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-body">
          Base pay, overtime, and trip allowances in — NAPSA, PAYE, NHIMA,
          and any advance recovery worked out correctly, net pay out. The
          statutory deductions use the current Zambian rates, sourced and
          dated below.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Pay this month</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="baseSalaryMonthlyZmw"
                label="Base salary (monthly)"
                value={form.baseSalaryMonthlyZmw}
                onChange={(v) => set("baseSalaryMonthlyZmw", v)}
                placeholder="e.g. 8000"
              />
              <NumberField
                id="tripAllowancesMonthlyZmw"
                label="Trip allowances (monthly)"
                value={form.tripAllowancesMonthlyZmw}
                onChange={(v) => set("tripAllowancesMonthlyZmw", v)}
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
                id="overtimeRateZmwPerHour"
                label="Overtime rate (ZMW/hour)"
                value={form.overtimeRateZmwPerHour}
                onChange={(v) => set("overtimeRateZmwPerHour", v)}
                placeholder="0"
              />
            </div>
          </fieldset>

          <fieldset className="card-surface p-6">
            <legend className="px-1 text-sm font-semibold text-navy">Advance &amp; other deductions</legend>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField
                id="outstandingAdvanceBalanceZmw"
                label="Outstanding advance balance"
                value={form.outstandingAdvanceBalanceZmw}
                onChange={(v) => set("outstandingAdvanceBalanceZmw", v)}
                placeholder="0"
                hint="What the driver still owes on a prior advance, before this pay period."
              />
              <NumberField
                id="advanceDeductionRequestedZmw"
                label="Advance to recover this period"
                value={form.advanceDeductionRequestedZmw}
                onChange={(v) => set("advanceDeductionRequestedZmw", v)}
                placeholder="0"
                hint="Capped automatically at the outstanding balance and at what's left after statutory deductions."
              />
              <NumberField
                id="otherDeductionsZmw"
                label="Other deductions"
                value={form.otherDeductionsZmw}
                onChange={(v) => set("otherDeductionsZmw", v)}
                placeholder="0"
                hint="Union dues, uniform, etc."
              />
            </div>
          </fieldset>

          <div className="card-surface p-6">
            <p className="text-sm font-semibold text-navy">Statutory rates used</p>
            <ul className="mt-3 space-y-2 text-sm text-body">
              <li>
                <strong className="text-navy">NAPSA:</strong> {(NAPSA.value.employeeRate * 100).toFixed(0)}% employee
                share, capped at {formatZmw(NAPSA.value.employeeCapZmw)}/month. {formatSourceLabel(NAPSA)}.
              </li>
              <li>
                <strong className="text-navy">NHIMA:</strong> {(NHIMA.value.employeeRate * 100).toFixed(0)}% of gross,
                no cap. {formatSourceLabel(NHIMA)}.
              </li>
              <li>
                <strong className="text-navy">PAYE:</strong> progressive bands from K0 to 37.5% above K9,900/month,
                applied after NAPSA. {formatSourceLabel(PAYE_BANDS)}.
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted">{PAYE_BANDS.note}</p>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface p-6">
            {hasEnoughToShow ? (
              <>
                <p className="text-sm font-medium text-muted">Net payable</p>
                <p className="mt-1 text-4xl font-bold text-navy">{formatZmw(result.netPayableZmw)}</p>
                <p className="mt-1 text-sm text-muted">from {formatZmw(result.grossPayZmw)} gross</p>

                <dl className="mt-6 space-y-3 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-body">Overtime pay</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.overtimePayZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">NAPSA (employee)</dt>
                    <dd className="font-medium text-navy">-{formatZmw(result.napsaEmployeeZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">PAYE</dt>
                    <dd className="font-medium text-navy">-{formatZmw(result.payeZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-body">NHIMA</dt>
                    <dd className="font-medium text-navy">-{formatZmw(result.nhimaZmw)}</dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border-soft pt-3">
                    <dt className="text-body">Net before advance</dt>
                    <dd className="font-medium text-navy">{formatZmw(result.netBeforeAdvanceZmw)}</dd>
                  </div>
                  {result.advanceDeductionAppliedZmw > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">Advance recovered</dt>
                      <dd className="font-medium text-navy">-{formatZmw(result.advanceDeductionAppliedZmw)}</dd>
                    </div>
                  )}
                  {result.otherDeductionsAppliedZmw > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">Other deductions</dt>
                      <dd className="font-medium text-navy">-{formatZmw(result.otherDeductionsAppliedZmw)}</dd>
                    </div>
                  )}
                  {result.remainingAdvanceBalanceZmw > 0 && (
                    <div className="flex items-center justify-between">
                      <dt className="text-body">Advance balance remaining</dt>
                      <dd className="font-medium text-navy">{formatZmw(result.remainingAdvanceBalanceZmw)}</dd>
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
