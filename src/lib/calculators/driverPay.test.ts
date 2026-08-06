import { describe, expect, it } from "vitest";
import { calculateDriverPay, type DriverPayInputs } from "./driverPay";
import { PAYE_BANDS, NAPSA, NHIMA } from "../benchmarks";

function baseInputs(overrides: Partial<DriverPayInputs> = {}): DriverPayInputs {
  return {
    baseSalaryMonthlyZmw: 8000,
    overtimeHours: 10,
    overtimeRateZmwPerHour: 50,
    tripAllowancesMonthlyZmw: 1000,
    otherDeductionsZmw: 0,
    outstandingAdvanceBalanceZmw: 0,
    advanceDeductionRequestedZmw: 0,
    napsaEmployeeRate: NAPSA.value.employeeRate,
    napsaEmployeeCapZmw: NAPSA.value.employeeCapZmw,
    nhimaEmployeeRate: NHIMA.value.employeeRate,
    payeBands: PAYE_BANDS.value,
    ...overrides,
  };
}

describe("calculateDriverPay", () => {
  it("computes gross pay from base + overtime + allowances", () => {
    const result = calculateDriverPay(baseInputs());
    expect(result.overtimePayZmw).toBeCloseTo(500);
    expect(result.grossPayZmw).toBeCloseTo(9500);
  });

  it("applies progressive PAYE bands after deducting NAPSA", () => {
    const result = calculateDriverPay(baseInputs());
    expect(result.napsaEmployeeZmw).toBeCloseTo(475);
    expect(result.payeZmw).toBeCloseTo(1077.5);
    expect(result.nhimaZmw).toBeCloseTo(95);
    expect(result.netBeforeAdvanceZmw).toBeCloseTo(7852.5);
  });

  it("caps NAPSA at the employee ceiling for a high salary", () => {
    const result = calculateDriverPay(
      baseInputs({ baseSalaryMonthlyZmw: 50000, overtimeHours: 0, tripAllowancesMonthlyZmw: 0 })
    );
    expect(result.napsaEmployeeZmw).toBeCloseTo(1861.8);
    expect(result.payeZmw).toBeCloseTo(15679.325, 2);
  });

  it("charges zero tax and zero statutory deductions on zero income", () => {
    const result = calculateDriverPay(
      baseInputs({ baseSalaryMonthlyZmw: 0, overtimeHours: 0, tripAllowancesMonthlyZmw: 0 })
    );
    expect(result.grossPayZmw).toBe(0);
    expect(result.napsaEmployeeZmw).toBe(0);
    expect(result.payeZmw).toBe(0);
    expect(result.netBeforeAdvanceZmw).toBe(0);
  });

  it("deducts a requested advance amount and reduces the running balance", () => {
    const result = calculateDriverPay(
      baseInputs({ outstandingAdvanceBalanceZmw: 2000, advanceDeductionRequestedZmw: 500, otherDeductionsZmw: 200 })
    );
    expect(result.advanceDeductionAppliedZmw).toBeCloseTo(500);
    expect(result.remainingAdvanceBalanceZmw).toBeCloseTo(1500);
    expect(result.otherDeductionsAppliedZmw).toBeCloseTo(200);
    expect(result.netPayableZmw).toBeCloseTo(7152.5);
  });

  it("clamps the advance deduction to the outstanding balance, not the requested amount", () => {
    const result = calculateDriverPay(
      baseInputs({ outstandingAdvanceBalanceZmw: 100, advanceDeductionRequestedZmw: 500 })
    );
    expect(result.advanceDeductionAppliedZmw).toBeCloseTo(100);
    expect(result.remainingAdvanceBalanceZmw).toBe(0);
  });

  it("never lets deductions push net payable below zero", () => {
    const result = calculateDriverPay(
      baseInputs({
        baseSalaryMonthlyZmw: 500,
        overtimeHours: 0,
        tripAllowancesMonthlyZmw: 0,
        outstandingAdvanceBalanceZmw: 5000,
        advanceDeductionRequestedZmw: 5000,
        otherDeductionsZmw: 5000,
      })
    );
    expect(result.netPayableZmw).toBeGreaterThanOrEqual(0);
    expect(result.advanceDeductionAppliedZmw).toBeLessThanOrEqual(result.netBeforeAdvanceZmw);
  });

  it("treats negative inputs as zero rather than reducing pay", () => {
    const result = calculateDriverPay(baseInputs({ overtimeHours: -5, tripAllowancesMonthlyZmw: -100 }));
    expect(result.overtimePayZmw).toBe(0);
    expect(result.grossPayZmw).toBeCloseTo(8000);
  });
});
