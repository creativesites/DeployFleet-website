export interface MonthlySavingsInputs {
  fuelZmw: number;
  complianceZmw: number;
  adminTimeZmw: number;
  maintenanceZmw: number;
  otherZmw: number;
}

export interface RoiPaybackInputs {
  monthlySubscriptionCostZmw: number;
  oneTimeImplementationCostZmw: number;
  monthlySavings: MonthlySavingsInputs;
}

export interface RoiPaybackResult {
  totalMonthlySavingsZmw: number;
  netMonthlyBenefitZmw: number;
  /** Months to recover the one-time implementation cost, or null if the net benefit is never positive. */
  paybackMonths: number | null;
  threeYearTotalCostZmw: number;
  threeYearTotalSavingsZmw: number;
  threeYearNetGainZmw: number;
  /** Return on the total 3-year cost, as a percentage. Null if 3-year cost is zero (return is undefined, not infinite). */
  threeYearRoiPercent: number | null;
}

const MONTHS_IN_3_YEARS = 36;

export function calculateRoiPayback(inputs: RoiPaybackInputs): RoiPaybackResult {
  const monthlySubscriptionCostZmw = Math.max(0, inputs.monthlySubscriptionCostZmw);
  const oneTimeImplementationCostZmw = Math.max(0, inputs.oneTimeImplementationCostZmw);

  const totalMonthlySavingsZmw =
    Math.max(0, inputs.monthlySavings.fuelZmw) +
    Math.max(0, inputs.monthlySavings.complianceZmw) +
    Math.max(0, inputs.monthlySavings.adminTimeZmw) +
    Math.max(0, inputs.monthlySavings.maintenanceZmw) +
    Math.max(0, inputs.monthlySavings.otherZmw);

  const netMonthlyBenefitZmw = totalMonthlySavingsZmw - monthlySubscriptionCostZmw;

  const paybackMonths =
    netMonthlyBenefitZmw > 0 ? oneTimeImplementationCostZmw / netMonthlyBenefitZmw : oneTimeImplementationCostZmw > 0 ? null : 0;

  const threeYearTotalCostZmw = oneTimeImplementationCostZmw + monthlySubscriptionCostZmw * MONTHS_IN_3_YEARS;
  const threeYearTotalSavingsZmw = totalMonthlySavingsZmw * MONTHS_IN_3_YEARS;
  const threeYearNetGainZmw = threeYearTotalSavingsZmw - threeYearTotalCostZmw;
  const threeYearRoiPercent = threeYearTotalCostZmw > 0 ? (threeYearNetGainZmw / threeYearTotalCostZmw) * 100 : null;

  return {
    totalMonthlySavingsZmw,
    netMonthlyBenefitZmw,
    paybackMonths,
    threeYearTotalCostZmw,
    threeYearTotalSavingsZmw,
    threeYearNetGainZmw,
    threeYearRoiPercent,
  };
}
