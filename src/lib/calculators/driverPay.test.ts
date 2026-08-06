import { describe, expect, it } from "vitest";
import { calculateDriverPay, type DriverPayInputs } from "./driverPay";
import { COUNTRIES } from "../countries";

const zmTax = COUNTRIES.ZM.incomeTax!.value;
const zmSocial = COUNTRIES.ZM.socialSecurity!.value;
const zmLevy = COUNTRIES.ZM.secondaryLevy!.value;

const zwTax = COUNTRIES.ZW.incomeTax!.value;
const zwSocial = COUNTRIES.ZW.socialSecurity!.value;

function zambiaInputs(overrides: Partial<DriverPayInputs> = {}): DriverPayInputs {
  return {
    baseSalaryMonthly: 8000,
    overtimeHours: 10,
    overtimeRatePerHour: 50,
    tripAllowancesMonthly: 1000,
    otherDeductions: 0,
    outstandingAdvanceBalance: 0,
    advanceDeductionRequested: 0,
    incomeTax: zmTax,
    socialSecurity: zmSocial,
    secondaryLevy: zmLevy,
    ...overrides,
  };
}

describe("calculateDriverPay — Zambia (monthly bands, NAPSA + PAYE + NHIMA)", () => {
  it("computes gross pay from base + overtime + allowances", () => {
    const result = calculateDriverPay(zambiaInputs());
    expect(result.overtimePay).toBeCloseTo(500);
    expect(result.grossPay).toBeCloseTo(9500);
  });

  it("applies progressive tax after deducting social security, plus the secondary levy", () => {
    const result = calculateDriverPay(zambiaInputs());
    expect(result.socialSecurityAmount).toBeCloseTo(475);
    expect(result.incomeTaxAmount).toBeCloseTo(1077.5);
    expect(result.taxLevyAmount).toBe(0);
    expect(result.secondaryLevyAmount).toBeCloseTo(95);
    expect(result.netBeforeAdvance).toBeCloseTo(7852.5);
  });

  it("caps social security at the employee ceiling for a high salary", () => {
    const result = calculateDriverPay(
      zambiaInputs({ baseSalaryMonthly: 50000, overtimeHours: 0, tripAllowancesMonthly: 0 })
    );
    expect(result.socialSecurityAmount).toBeCloseTo(1861.8);
  });

  it("deducts a requested advance amount and reduces the running balance", () => {
    const result = calculateDriverPay(
      zambiaInputs({ outstandingAdvanceBalance: 2000, advanceDeductionRequested: 500, otherDeductions: 200 })
    );
    expect(result.advanceDeductionApplied).toBeCloseTo(500);
    expect(result.remainingAdvanceBalance).toBeCloseTo(1500);
    expect(result.netPayable).toBeCloseTo(7152.5);
  });

  it("never lets deductions push net payable below zero", () => {
    const result = calculateDriverPay(
      zambiaInputs({
        baseSalaryMonthly: 500,
        overtimeHours: 0,
        tripAllowancesMonthly: 0,
        outstandingAdvanceBalance: 5000,
        advanceDeductionRequested: 5000,
        otherDeductions: 5000,
      })
    );
    expect(result.netPayable).toBeGreaterThanOrEqual(0);
  });

  it("treats negative inputs as zero rather than reducing pay", () => {
    const result = calculateDriverPay(zambiaInputs({ overtimeHours: -5, tripAllowancesMonthly: -100 }));
    expect(result.overtimePay).toBe(0);
    expect(result.grossPay).toBeCloseTo(8000);
  });

  it("charges zero tax and zero statutory deductions on zero income", () => {
    const result = calculateDriverPay(
      zambiaInputs({ baseSalaryMonthly: 0, overtimeHours: 0, tripAllowancesMonthly: 0 })
    );
    expect(result.grossPay).toBe(0);
    expect(result.netBeforeAdvance).toBe(0);
  });
});

describe("calculateDriverPay — Zimbabwe (annual bands converted to monthly, PAYE + AIDS levy + NSSA, no secondary levy)", () => {
  function zimbabweInputs(overrides: Partial<DriverPayInputs> = {}): DriverPayInputs {
    return {
      baseSalaryMonthly: 1000,
      overtimeHours: 0,
      overtimeRatePerHour: 0,
      tripAllowancesMonthly: 0,
      otherDeductions: 0,
      outstandingAdvanceBalance: 0,
      advanceDeductionRequested: 0,
      incomeTax: zwTax,
      socialSecurity: zwSocial,
      secondaryLevy: null,
      ...overrides,
    };
  }

  it("annualizes the monthly taxable base against Zimbabwe's annual bands, then divides back down", () => {
    const result = calculateDriverPay(zimbabweInputs());
    expect(result.socialSecurityAmount).toBeCloseTo(24.5);
    expect(result.incomeTaxAmount).toBeCloseTo(208.875, 2);
  });

  it("adds the AIDS levy as a percentage of the computed tax, not of gross pay", () => {
    const result = calculateDriverPay(zimbabweInputs());
    expect(result.taxLevyAmount).toBeCloseTo(6.266, 2);
    expect(result.taxLevyLabel).toBe("AIDS levy");
  });

  it("has no secondary levy for a country with none configured", () => {
    const result = calculateDriverPay(zimbabweInputs());
    expect(result.secondaryLevyAmount).toBe(0);
    expect(result.secondaryLevyLabel).toBe("");
  });

  it("computes net payable correctly end to end", () => {
    const result = calculateDriverPay(zimbabweInputs());
    // gross 1000 - (24.5 NSSA + 208.875 tax + 6.26625 levy)
    expect(result.netPayable).toBeCloseTo(760.359, 2);
  });
});
