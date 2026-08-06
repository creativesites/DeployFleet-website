import type { IncomeTaxConfig, SecondaryLevyConfig, SocialSecurityConfig } from "../countries";

export interface DriverPayInputs {
  baseSalaryMonthly: number;
  overtimeHours: number;
  overtimeRatePerHour: number;
  tripAllowancesMonthly: number;
  /** Any other monthly deduction not covered above (union dues, uniform, etc). */
  otherDeductions: number;
  /** Total the driver still owes on a prior advance/loan, before this period. */
  outstandingAdvanceBalance: number;
  /** How much of the advance to recover this pay period. */
  advanceDeductionRequested: number;
  incomeTax: IncomeTaxConfig;
  socialSecurity: SocialSecurityConfig;
  /** Null for a country with no second statutory levy (e.g. no NHIMA-equivalent). */
  secondaryLevy: SecondaryLevyConfig | null;
}

export interface DriverPayResult {
  overtimePay: number;
  grossPay: number;
  socialSecurityAmount: number;
  socialSecurityLabel: string;
  /** The base progressive-band tax, before any levy-on-tax is added. */
  incomeTaxAmount: number;
  /** A levy computed as a % of incomeTaxAmount (e.g. Zimbabwe's AIDS levy). 0 where not applicable. */
  taxLevyAmount: number;
  taxLevyLabel: string;
  /** A second statutory deduction on gross (e.g. Zambia's NHIMA). 0 where not applicable. */
  secondaryLevyAmount: number;
  secondaryLevyLabel: string;
  statutoryDeductions: number;
  netBeforeAdvance: number;
  advanceDeductionApplied: number;
  otherDeductionsApplied: number;
  netPayable: number;
  remainingAdvanceBalance: number;
}

function computeProgressiveTax(taxableAmount: number, bands: IncomeTaxConfig["bands"]): number {
  let tax = 0;
  for (const band of bands) {
    if (taxableAmount <= band.from) break;
    const bandTop = band.to === null ? taxableAmount : Math.min(band.to, taxableAmount);
    const amountInBand = Math.max(0, bandTop - band.from);
    tax += amountInBand * band.rate;
  }
  return tax;
}

export function calculateDriverPay(inputs: DriverPayInputs): DriverPayResult {
  const overtimePay = Math.max(0, inputs.overtimeHours) * Math.max(0, inputs.overtimeRatePerHour);
  const grossPay = Math.max(0, inputs.baseSalaryMonthly) + overtimePay + Math.max(0, inputs.tripAllowancesMonthly);

  const socialSecurityAmount = Math.min(grossPay * inputs.socialSecurity.employeeRate, inputs.socialSecurity.employeeCapPerMonth ?? Infinity);

  const monthlyTaxableBase = grossPay - socialSecurityAmount;
  const incomeTaxAmount =
    inputs.incomeTax.period === "monthly"
      ? computeProgressiveTax(monthlyTaxableBase, inputs.incomeTax.bands)
      : computeProgressiveTax(monthlyTaxableBase * 12, inputs.incomeTax.bands) / 12;

  const taxLevyAmount = incomeTaxAmount * (inputs.incomeTax.levyOnTaxPercent / 100);

  const secondaryLevyAmount = inputs.secondaryLevy
    ? Math.min(grossPay * inputs.secondaryLevy.employeeRate, inputs.secondaryLevy.employeeCapPerMonth ?? Infinity)
    : 0;

  const statutoryDeductions = socialSecurityAmount + incomeTaxAmount + taxLevyAmount + secondaryLevyAmount;
  const netBeforeAdvance = Math.max(0, grossPay - statutoryDeductions);

  const advanceDeductionApplied = Math.min(
    Math.max(0, inputs.advanceDeductionRequested),
    Math.max(0, inputs.outstandingAdvanceBalance),
    netBeforeAdvance
  );
  const remainingAfterAdvance = netBeforeAdvance - advanceDeductionApplied;

  const otherDeductionsApplied = Math.min(Math.max(0, inputs.otherDeductions), remainingAfterAdvance);
  const netPayable = remainingAfterAdvance - otherDeductionsApplied;

  const remainingAdvanceBalance = Math.max(0, inputs.outstandingAdvanceBalance - advanceDeductionApplied);

  return {
    overtimePay,
    grossPay,
    socialSecurityAmount,
    socialSecurityLabel: inputs.socialSecurity.label,
    incomeTaxAmount,
    taxLevyAmount,
    taxLevyLabel: inputs.incomeTax.levyOnTaxLabel,
    secondaryLevyAmount,
    secondaryLevyLabel: inputs.secondaryLevy?.label ?? "",
    statutoryDeductions,
    netBeforeAdvance,
    advanceDeductionApplied,
    otherDeductionsApplied,
    netPayable,
    remainingAdvanceBalance,
  };
}
