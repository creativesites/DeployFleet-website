import { describe, expect, it } from "vitest";
import { calculateRoiPayback, type RoiPaybackInputs } from "./roiPayback";

function baseInputs(overrides: Partial<RoiPaybackInputs> = {}): RoiPaybackInputs {
  return {
    monthlySubscriptionCostZmw: 3000,
    oneTimeImplementationCostZmw: 15_000,
    monthlySavings: { fuelZmw: 4000, complianceZmw: 1500, adminTimeZmw: 2000, maintenanceZmw: 1000, otherZmw: 500 },
    ...overrides,
  };
}

describe("calculateRoiPayback", () => {
  it("sums monthly savings across every category", () => {
    const result = calculateRoiPayback(baseInputs());
    expect(result.totalMonthlySavingsZmw).toBeCloseTo(9000);
  });

  it("computes net monthly benefit as savings minus subscription cost", () => {
    const result = calculateRoiPayback(baseInputs());
    expect(result.netMonthlyBenefitZmw).toBeCloseTo(6000);
  });

  it("computes payback months as implementation cost over net monthly benefit", () => {
    const result = calculateRoiPayback(baseInputs());
    expect(result.paybackMonths).toBeCloseTo(2.5);
  });

  it("computes 3-year totals and ROI percent", () => {
    const result = calculateRoiPayback(baseInputs());
    expect(result.threeYearTotalCostZmw).toBeCloseTo(123_000);
    expect(result.threeYearTotalSavingsZmw).toBeCloseTo(324_000);
    expect(result.threeYearNetGainZmw).toBeCloseTo(201_000);
    expect(result.threeYearRoiPercent).toBeCloseTo(163.4146, 3);
  });

  it("reports payback as unreachable (null) when net monthly benefit is negative and there's a real cost to recover", () => {
    const result = calculateRoiPayback(baseInputs({ monthlySubscriptionCostZmw: 10_000 }));
    expect(result.netMonthlyBenefitZmw).toBeLessThan(0);
    expect(result.paybackMonths).toBeNull();
  });

  it("reports zero payback months when there's no implementation cost to recover at all", () => {
    const result = calculateRoiPayback(baseInputs({ monthlySubscriptionCostZmw: 10_000, oneTimeImplementationCostZmw: 0 }));
    expect(result.paybackMonths).toBe(0);
  });

  it("returns a null ROI percent rather than dividing by zero when 3-year cost is zero", () => {
    const result = calculateRoiPayback(
      baseInputs({ monthlySubscriptionCostZmw: 0, oneTimeImplementationCostZmw: 0 })
    );
    expect(result.threeYearTotalCostZmw).toBe(0);
    expect(result.threeYearRoiPercent).toBeNull();
  });

  it("treats negative savings/cost inputs as zero rather than reducing totals", () => {
    const result = calculateRoiPayback(
      baseInputs({ monthlySavings: { fuelZmw: -1000, complianceZmw: 1500, adminTimeZmw: 2000, maintenanceZmw: 1000, otherZmw: 500 } })
    );
    expect(result.totalMonthlySavingsZmw).toBeCloseTo(5000);
  });
});
