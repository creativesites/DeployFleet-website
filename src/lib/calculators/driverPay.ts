import type { PayeBand } from "../benchmarks";

export interface DriverPayInputs {
  baseSalaryMonthlyZmw: number;
  overtimeHours: number;
  overtimeRateZmwPerHour: number;
  tripAllowancesMonthlyZmw: number;
  /** Any other monthly deduction not covered above (union dues, uniform, etc). */
  otherDeductionsZmw: number;
  /** Total the driver still owes on a prior advance/loan, before this period. */
  outstandingAdvanceBalanceZmw: number;
  /** How much of the advance to recover this pay period. */
  advanceDeductionRequestedZmw: number;
  napsaEmployeeRate: number;
  napsaEmployeeCapZmw: number;
  nhimaEmployeeRate: number;
  payeBands: PayeBand[];
}

export interface DriverPayResult {
  overtimePayZmw: number;
  grossPayZmw: number;
  napsaEmployeeZmw: number;
  payeZmw: number;
  nhimaZmw: number;
  statutoryDeductionsZmw: number;
  netBeforeAdvanceZmw: number;
  advanceDeductionAppliedZmw: number;
  otherDeductionsAppliedZmw: number;
  netPayableZmw: number;
  remainingAdvanceBalanceZmw: number;
}

function computeProgressivePaye(taxableAfterNapsaZmw: number, bands: PayeBand[]): number {
  let tax = 0;
  for (const band of bands) {
    if (taxableAfterNapsaZmw <= band.fromZmw) break;
    const bandTop = band.toZmw === null ? taxableAfterNapsaZmw : Math.min(band.toZmw, taxableAfterNapsaZmw);
    const amountInBand = Math.max(0, bandTop - band.fromZmw);
    tax += amountInBand * band.rate;
  }
  return tax;
}

export function calculateDriverPay(inputs: DriverPayInputs): DriverPayResult {
  const overtimePayZmw = Math.max(0, inputs.overtimeHours) * Math.max(0, inputs.overtimeRateZmwPerHour);
  const grossPayZmw = Math.max(0, inputs.baseSalaryMonthlyZmw) + overtimePayZmw + Math.max(0, inputs.tripAllowancesMonthlyZmw);

  const napsaEmployeeZmw = Math.min(grossPayZmw * inputs.napsaEmployeeRate, inputs.napsaEmployeeCapZmw);
  const payeZmw = computeProgressivePaye(grossPayZmw - napsaEmployeeZmw, inputs.payeBands);
  const nhimaZmw = grossPayZmw * inputs.nhimaEmployeeRate;

  const statutoryDeductionsZmw = napsaEmployeeZmw + payeZmw + nhimaZmw;
  const netBeforeAdvanceZmw = Math.max(0, grossPayZmw - statutoryDeductionsZmw);

  const advanceDeductionAppliedZmw = Math.min(
    Math.max(0, inputs.advanceDeductionRequestedZmw),
    Math.max(0, inputs.outstandingAdvanceBalanceZmw),
    netBeforeAdvanceZmw
  );
  const remainingAfterAdvanceZmw = netBeforeAdvanceZmw - advanceDeductionAppliedZmw;

  const otherDeductionsAppliedZmw = Math.min(Math.max(0, inputs.otherDeductionsZmw), remainingAfterAdvanceZmw);
  const netPayableZmw = remainingAfterAdvanceZmw - otherDeductionsAppliedZmw;

  const remainingAdvanceBalanceZmw = Math.max(0, inputs.outstandingAdvanceBalanceZmw - advanceDeductionAppliedZmw);

  return {
    overtimePayZmw,
    grossPayZmw,
    napsaEmployeeZmw,
    payeZmw,
    nhimaZmw,
    statutoryDeductionsZmw,
    netBeforeAdvanceZmw,
    advanceDeductionAppliedZmw,
    otherDeductionsAppliedZmw,
    netPayableZmw,
    remainingAdvanceBalanceZmw,
  };
}
